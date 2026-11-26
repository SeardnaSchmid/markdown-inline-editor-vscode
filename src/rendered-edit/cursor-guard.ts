import * as vscode from 'vscode';
import type { MarkdownParseCache } from '../markdown-parse-cache';
import {
  buildRenderedEditMap,
  findMarkerEndingAt,
  findMarkerStartingAt,
  findMarkerStrictlyContaining,
  findVisibleWordBoundary,
  isOffsetInRawFallbackBlock,
  type RenderedEditMap,
} from './marker-map';

function skipTableCellPadding(
  map: RenderedEditMap,
  pos: number,
  textLen: number,
  direction: 'left' | 'right'
): number {
  let cur = pos;
  if (direction === 'right') {
    while (cur < textLen) {
      const pad = findMarkerStartingAt(map.mergedMarkers, cur);
      if (!pad || pad.isAtomic || pad.isTableBoundary) break;
      cur = pad.end;
    }
  } else {
    while (cur > 0) {
      const pad = findMarkerEndingAt(map.mergedMarkers, cur);
      if (!pad || pad.isAtomic || pad.isTableBoundary) break;
      cur = pad.start;
    }
  }
  return cur;
}

function tryMoveWithinTable(
  doc: vscode.TextDocument,
  map: RenderedEditMap,
  pos: number,
  direction: 'left' | 'right'
): number | undefined {
  const curLine = doc.positionAt(pos).line;
  const rowCells = map.tableCellsByLine.get(curLine);
  if (!rowCells || rowCells.length === 0) {
    return undefined;
  }

  if (direction === 'right') {
    const lastCell = rowCells[rowCells.length - 1];
    if (pos >= lastCell.end) {
      let nextLine = curLine + 1;
      while (nextLine < doc.lineCount && map.tableSeparatorLines.has(nextLine)) {
        nextLine++;
      }
      if (nextLine >= doc.lineCount) {
        return lastCell.end;
      }
      const nextCells = map.tableCellsByLine.get(nextLine);
      if (nextCells && nextCells.length > 0) {
        return nextCells[0].start;
      }
      let nextPos = doc.offsetAt(doc.lineAt(nextLine).range.start);
      const docLen = doc.getText().length;
      while (nextPos < docLen) {
        const prefix = findMarkerStartingAt(map.mergedMarkers, nextPos);
        if (!prefix || !prefix.isLinePrefix) break;
        nextPos = prefix.end;
      }
      return nextPos;
    }

    for (let i = 0; i < rowCells.length - 1; i++) {
      if (pos >= rowCells[i].end && pos < rowCells[i + 1].start) {
        return rowCells[i + 1].start;
      }
    }
    return undefined;
  }

  const firstCell = rowCells[0];
  if (pos <= firstCell.start) {
    let prevLine = curLine - 1;
    while (prevLine >= 0 && map.tableSeparatorLines.has(prevLine)) {
      prevLine--;
    }
    if (prevLine < 0) {
      return firstCell.start;
    }
    const prevCells = map.tableCellsByLine.get(prevLine);
    return prevCells && prevCells.length > 0
      ? prevCells[prevCells.length - 1].end
      : doc.offsetAt(doc.lineAt(prevLine).range.end);
  }

  for (let i = 1; i < rowCells.length; i++) {
    if (pos <= rowCells[i].start && pos > rowCells[i - 1].end) {
      return rowCells[i - 1].end;
    }
  }
  return undefined;
}

/**
 * If an empty caret lands on a table separator line or on a table border/pipe/padding
 * outside editable cell text, returns the nearest valid offset inside a table cell.
 */
function snapOffsetToTableCell(
  doc: vscode.TextDocument,
  map: RenderedEditMap,
  offset: number,
  movingLeft: boolean,
  isMouse: boolean
): number | undefined {
  const pos = doc.positionAt(offset);
  const line = pos.line;

  if (map.tableSeparatorLines.has(line)) {
    const preferred = movingLeft ? line - 1 : line + 1;
    const fallback = movingLeft ? line + 1 : line - 1;
    const targetCells =
      map.tableCellsByLine.get(preferred) ?? map.tableCellsByLine.get(fallback);
    if (!targetCells || targetCells.length === 0) {
      return undefined;
    }
    const targetLineStart = doc.offsetAt(doc.lineAt(doc.positionAt(targetCells[0].start).line).range.start);
    const approxTargetOff = targetLineStart + pos.character;
    let best = targetCells[0].start;
    let bestDist = Math.abs(approxTargetOff - best);
    for (const c of targetCells) {
      const clamped = Math.max(c.start, Math.min(c.end, approxTargetOff));
      const dist = Math.abs(approxTargetOff - clamped);
      if (dist < bestDist) {
        bestDist = dist;
        best = clamped;
      }
    }
    return best;
  }

  const cells = map.tableCellsByLine.get(line);
  if (!cells || cells.length === 0) {
    return undefined;
  }

  if (cells.some((c) => offset >= c.start && offset <= c.end)) {
    return undefined;
  }

  if (offset < cells[0].start) {
    return cells[0].start;
  }
  const last = cells[cells.length - 1];
  if (offset > last.end) {
    return last.end;
  }

  for (let i = 0; i < cells.length - 1; i++) {
    const leftEnd = cells[i].end;
    const rightStart = cells[i + 1].start;
    if (offset > leftEnd && offset < rightStart) {
      if (isMouse) {
        return offset - leftEnd <= rightStart - offset ? leftEnd : rightStart;
      }
      return movingLeft ? leftEnd : rightStart;
    }
  }

  return cells[0].start;
}

interface PendingCursorMove {
  version: number;
  offsets: number[];
  anchors: number[];
  minPrimary: number;
  maxPrimary: number;
  updatedAt: number;
}

export interface MoveCursorOptions {
  select?: boolean;
  byWord?: boolean;
}

const PENDING_MOVE_TTL_MS = 400;

/**
 * Keeps carets out of hidden/protected markdown syntax markers in Rendered Edit mode
 * and provides single-keypress Left/Right movement across hidden delimiters.
 */
export class RenderedEditCursorGuard {
  private adjustingSelection = false;
  private readonly lastPrimaryOffsets = new Map<string, number>();
  private readonly pendingMoves = new Map<string, PendingCursorMove>();

  handleSelectionChange(
    editor: vscode.TextEditor,
    parseCache: MarkdownParseCache,
    kind?: vscode.TextEditorSelectionChangeKind
  ): boolean {
    if (this.adjustingSelection || editor.selections.length === 0) {
      return false;
    }

    const doc = editor.document;
    const uriKey = doc.uri.toString();
    const curPrimary = doc.offsetAt(editor.selection.active);

    const pending = this.pendingMoves.get(uriKey);
    if (pending) {
      const expired =
        pending.version !== doc.version || Date.now() - pending.updatedAt > PENDING_MOVE_TTL_MS;
      if (expired || kind === vscode.TextEditorSelectionChangeKind.Mouse) {
        this.pendingMoves.delete(uriKey);
      } else if (curPrimary === pending.offsets[0]) {
        // Renderer caught up to our latest programmatic cursor position.
        this.pendingMoves.delete(uriKey);
        this.lastPrimaryOffsets.set(uriKey, curPrimary);
      } else if (curPrimary >= pending.minPrimary && curPrimary <= pending.maxPrimary) {
        // Stale in-flight IPC echo from an earlier key-repeat step: ignore it so it
        // does not reverse direction detection or bounce the caret backwards.
        return true;
      } else {
        // Unrelated cursor jump (Up/Down/Home/End/command).
        this.pendingMoves.delete(uriKey);
      }
    }

    const prevPrimary = this.lastPrimaryOffsets.get(uriKey);
    const movingLeft = prevPrimary !== undefined && curPrimary < prevPrimary;

    const entry = parseCache.get(doc);
    const map = buildRenderedEditMap(doc, entry);

    let changed = false;
    const adjusted: vscode.Selection[] = [];

    for (const sel of editor.selections) {
      // Never rewrite non-empty selections during drag-select or Shift+Arrow;
      // deletion handlers already preserve protected markers inside selections.
      if (!sel.isEmpty) {
        adjusted.push(sel);
        continue;
      }

      const activeOff = doc.offsetAt(sel.active);
      if (isOffsetInRawFallbackBlock(map, activeOff)) {
        adjusted.push(sel);
        continue;
      }

      const tableSnap = snapOffsetToTableCell(
        doc,
        map,
        activeOff,
        movingLeft,
        kind === vscode.TextEditorSelectionChangeKind.Mouse
      );
      if (tableSnap !== undefined) {
        const snapPos = doc.positionAt(tableSnap);
        adjusted.push(new vscode.Selection(snapPos, snapPos));
        changed = true;
        continue;
      }

      const inside = findMarkerStrictlyContaining(map.mergedMarkers, activeOff);
      const linePrefixAtStart = !inside
        ? (() => {
            const m = findMarkerStartingAt(map.mergedMarkers, activeOff);
            return m && m.isLinePrefix ? m : undefined;
          })()
        : undefined;
      const target = inside ?? linePrefixAtStart;

      if (!target) {
        adjusted.push(sel);
        continue;
      }

      // Let mouse clicks on rendered checkboxes reach Decorator's checkbox toggle handler.
      if (kind === vscode.TextEditorSelectionChangeKind.Mouse && target.isCheckbox) {
        adjusted.push(sel);
        continue;
      }

      const snapOff = target.isLinePrefix
        ? target.end
        : movingLeft
          ? target.start
          : target.end;
      const snapPos = doc.positionAt(snapOff);

      adjusted.push(new vscode.Selection(snapPos, snapPos));
      changed = true;
    }

    if (changed) {
      this.adjustingSelection = true;
      try {
        editor.selections = adjusted;
        this.lastPrimaryOffsets.set(uriKey, doc.offsetAt(adjusted[0].active));
      } finally {
        this.adjustingSelection = false;
      }
      return true;
    }

    this.lastPrimaryOffsets.set(uriKey, curPrimary);
    return false;
  }

  moveCursor(
    editor: vscode.TextEditor,
    parseCache: MarkdownParseCache,
    direction: 'left' | 'right',
    options?: MoveCursorOptions
  ): boolean {
    const select = options?.select ?? false;
    const byWord = options?.byWord ?? false;
    const doc = editor.document;
    const uriKey = doc.uri.toString();
    const text = doc.getText();
    const entry = parseCache.get(doc);
    const map = buildRenderedEditMap(doc, entry);

    const existingPending = this.pendingMoves.get(uriKey);
    const usePending =
      existingPending !== undefined &&
      existingPending.version === doc.version &&
      Date.now() - existingPending.updatedAt <= PENDING_MOVE_TTL_MS &&
      existingPending.offsets.length === editor.selections.length;

    const baseActives: number[] = [];
    const baseAnchors: number[] = [];
    for (let i = 0; i < editor.selections.length; i++) {
      const sel = editor.selections[i];
      if (!select && !sel.isEmpty) {
        this.pendingMoves.delete(uriKey);
        return false;
      }
      const activeOff = usePending ? existingPending.offsets[i] : doc.offsetAt(sel.active);
      const anchorOff = select
        ? usePending
          ? existingPending.anchors[i]
          : doc.offsetAt(sel.anchor)
        : activeOff;
      if (isOffsetInRawFallbackBlock(map, activeOff)) {
        this.pendingMoves.delete(uriKey);
        return false;
      }
      baseActives.push(activeOff);
      baseAnchors.push(anchorOff);
    }

    const nextOffsets: number[] = [];
    const nextAnchors: number[] = [];
    const nextSelections: vscode.Selection[] = [];

    for (let i = 0; i < baseActives.length; i++) {
      let pos = baseActives[i];

      if (byWord) {
        pos = findVisibleWordBoundary(
          text,
          map,
          pos,
          direction === 'right' ? 'forward' : 'backward'
        );
      } else {
        const tablePos = tryMoveWithinTable(doc, map, pos, direction);
        if (tablePos !== undefined) {
          pos = tablePos;
        } else if (direction === 'right') {
          const inside = findMarkerStrictlyContaining(map.mergedMarkers, pos);
          let skippedAtomic = false;
          if (inside) {
            pos = inside.end;
            skippedAtomic = inside.isAtomic;
          }

          if (!skippedAtomic) {
            while (pos < text.length) {
              const m = findMarkerStartingAt(map.mergedMarkers, pos);
              if (!m) break;
              pos = m.end;
              if (m.isAtomic) {
                skippedAtomic = true;
                if (m.isTableBoundary) {
                  pos = skipTableCellPadding(map, pos, text.length, 'right');
                }
                break;
              }
            }
          }

          if (!skippedAtomic && pos < text.length) {
            const step = text[pos] === '\r' && text[pos + 1] === '\n' ? 2 : 1;
            pos += step;
            if (step === 2 || text[pos - 1] === '\n') {
              const landedCells = map.tableCellsByLine.get(doc.positionAt(pos).line);
              if (landedCells && landedCells.length > 0) {
                pos = landedCells[0].start;
              } else {
                while (pos < text.length) {
                  const prefix = findMarkerStartingAt(map.mergedMarkers, pos);
                  if (!prefix || !prefix.isLinePrefix) break;
                  pos = prefix.end;
                }
              }
            }
          }
        } else {
          const inside = findMarkerStrictlyContaining(map.mergedMarkers, pos);
          let skippedAtomic = false;
          let hitDocStartLinePrefixEnd: number | undefined;
          if (inside) {
            if (inside.isLinePrefix && inside.start === 0) {
              hitDocStartLinePrefixEnd = inside.end;
            } else {
              pos = inside.start;
              skippedAtomic = inside.isAtomic;
            }
          }

          if (hitDocStartLinePrefixEnd === undefined && !skippedAtomic) {
            while (pos > 0) {
              const m = findMarkerEndingAt(map.mergedMarkers, pos);
              if (!m) break;
              if (m.isLinePrefix && m.start === 0) {
                hitDocStartLinePrefixEnd = m.end;
                break;
              }
              pos = m.start;
              if (m.isAtomic) {
                skippedAtomic = true;
                if (m.isTableBoundary) {
                  pos = skipTableCellPadding(map, pos, text.length, 'left');
                }
                break;
              }
            }
          }

          if (hitDocStartLinePrefixEnd !== undefined) {
            pos = hitDocStartLinePrefixEnd;
          } else if (!skippedAtomic && pos > 0) {
            const step = pos >= 2 && text[pos - 1] === '\n' && text[pos - 2] === '\r' ? 2 : 1;
            pos -= step;
            if (step === 2 || text[pos] === '\n') {
              const landedCells = map.tableCellsByLine.get(doc.positionAt(pos).line);
              if (landedCells && landedCells.length > 0) {
                pos = landedCells[landedCells.length - 1].end;
              }
            }
          }
        }
      }

      const clamped = Math.max(0, Math.min(text.length, pos));
      const anchor = select ? baseAnchors[i] : clamped;
      nextOffsets.push(clamped);
      nextAnchors.push(anchor);
      const nextActivePos = doc.positionAt(clamped);
      const nextAnchorPos = select ? doc.positionAt(anchor) : nextActivePos;
      nextSelections.push(new vscode.Selection(nextAnchorPos, nextActivePos));
    }

    const primaryStart = baseActives[0];
    const primaryNext = nextOffsets[0];
    if (primaryNext !== undefined) {
      this.pendingMoves.set(uriKey, {
        version: doc.version,
        offsets: nextOffsets,
        anchors: nextAnchors,
        minPrimary: usePending
          ? Math.min(existingPending.minPrimary, primaryStart, primaryNext)
          : Math.min(primaryStart, primaryNext),
        maxPrimary: usePending
          ? Math.max(existingPending.maxPrimary, primaryStart, primaryNext)
          : Math.max(primaryStart, primaryNext),
        updatedAt: Date.now(),
      });
    }

    this.adjustingSelection = true;
    try {
      editor.selections = nextSelections;
      if (nextSelections.length > 0) {
        this.lastPrimaryOffsets.set(uriKey, primaryNext);
        editor.revealRange(new vscode.Range(nextSelections[0].active, nextSelections[0].active));
      }
    } finally {
      this.adjustingSelection = false;
    }
    return true;
  }
}
