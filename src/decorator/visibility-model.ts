import { Range, ThemeColor, type DecorationOptions, type Position, type TextEditor } from 'vscode';
import type { DecorationRange, DecorationType } from '../parser';
import { isMarkerDecorationType } from './decoration-categories';

export type ScopeEntry = {
  startPos: number;
  endPos: number;
  range: Range;
  kind?: string;
};

type RangeFactory = (startPos: number, endPos: number, originalText: string) => Range | null;
type FilteredDecoration = Range | DecorationOptions;

export function filterDecorationsForEditor(
  editor: TextEditor,
  decorations: DecorationRange[],
  scopes: ScopeEntry[],
  originalText: string,
  rangeFactory: RangeFactory
): Map<DecorationType, FilteredDecoration[]> {
  const selectedRanges: Range[] = [];
  const cursorPositions: Position[] = [];
  const activeLines = new Set<number>(); // Lines with selections or cursors

  for (const selection of editor.selections) {
    if (!selection.isEmpty) {
      selectedRanges.push(selection);
      // Add all lines in the selection to activeLines
      for (let line = selection.start.line; line <= selection.end.line; line++) {
        activeLines.add(line);
      }
    } else {
      cursorPositions.push(selection.start);
      activeLines.add(selection.start.line);
    }
  }

  const rawRanges = mergeRanges([
    ...collectRawRanges(selectedRanges, scopes),
    ...collectCursorScopeRanges(cursorPositions, scopes),
  ]);

  const selectionOnlyMarkerTypes = new Set<DecorationType>([
    'blockquote',
    'listItem',
    'orderedListItem',
    'checkboxUnchecked',
    'checkboxChecked',
  ]);
  const headingTypes = new Set<DecorationType>([
    'heading',
    'heading1',
    'heading2',
    'heading3',
    'heading4',
    'heading5',
    'heading6',
  ]);
  const headingMarkerEndPositions = new Set<number>();
  for (const decoration of decorations) {
    if (headingTypes.has(decoration.type)) {
      headingMarkerEndPositions.add(decoration.startPos);
    }
  }

  // Table decoration types that use per-range replacement rendering
  const tableTypes = new Set<DecorationType>([
    'tablePipe', 'tableSeparatorPipe', 'tableSeparatorDash', 'tableCell',
  ]);

  // For table blocks, if cursor/selection is on ANY line in the table,
  // reveal the entire table (show raw markdown, not decorations).
  const tableScopes = scopes.filter(s => s.kind === 'table');
  const rawTableRanges: Range[] = [];
  for (const tableScope of tableScopes) {
    let tableIsActive = false;
    for (let line = tableScope.range.start.line; line <= tableScope.range.end.line; line++) {
      if (activeLines.has(line)) {
        tableIsActive = true;
        break;
      }
    }
    if (tableIsActive) {
      rawTableRanges.push(tableScope.range);
    }
  }

  const filtered = new Map<DecorationType, FilteredDecoration[]>();
  const ghostFaintRanges: Range[] = [];
  const selectionOverlayRanges: Range[] = [];

  const selectionOrCursorOverlaps = (range: Range): boolean => {
    const selectionOverlaps = selectedRanges.some((selection) => {
      const intersection = range.intersection(selection);
      return intersection !== undefined;
    });
    if (selectionOverlaps) {
      return true;
    }
    return cursorPositions.some((position) => range.contains(position));
  };

  for (const decoration of decorations) {
    const range = rangeFactory(decoration.startPos, decoration.endPos, originalText);
    if (!range) continue;
    const isActiveLine = activeLines.size > 0 && activeLines.has(range.start.line);

    // Code blocks and frontmatter use opaque, whole-line backgrounds.
    // On some themes, VS Code's native selection highlight is drawn "under" those
    // backgrounds, making selections appear invisible. We keep the background,
    // but add an explicit selection overlay decoration on top for the intersection.
    if ((decoration.type === 'codeBlock' || decoration.type === 'frontmatter') && selectedRanges.length > 0) {
      for (const selection of selectedRanges) {
        const intersection = range.intersection(selection);
        if (intersection !== undefined) {
          selectionOverlayRanges.push(intersection);
        }
      }
    }

    if (selectionOnlyMarkerTypes.has(decoration.type)) {
      if (selectionOrCursorOverlaps(range)) {
        // Raw state: show actual marker characters
        continue;
      }
      // Rendered state: apply marker decorations even on active lines
      const ranges = filtered.get(decoration.type) || [];
      if (decoration.replacement) {
        const beforeOpts: Record<string, unknown> = {
          contentText: decoration.replacement,
        };
        if (decoration.orderedListMarkerMismatch) {
          beforeOpts.color = new ThemeColor('editorWarning.foreground');
        }
        ranges.push({
          range,
          renderOptions: {
            before: beforeOpts,
          },
        });
      } else {
        ranges.push(range);
      }
      filtered.set(decoration.type, ranges);
      continue;
    }

    if (headingTypes.has(decoration.type) && isActiveLine) {
      // Show raw heading text (no heading styling) on active lines
      continue;
    }

    if (decoration.type === 'hide' || decoration.type === 'transparent') {
      const intersectsRaw = rangeIntersectsAny(range, rawRanges);
      const isHeadingMarkerHide = decoration.type === 'hide' &&
        headingMarkerEndPositions.has(decoration.endPos);

      if (intersectsRaw) {
        // Raw state: skip (show actual syntax)
        continue;
      }
      if (isHeadingMarkerHide && isActiveLine) {
        // Show heading markers on active lines
        continue;
      }
      if (isActiveLine) {
        // Ghost state: show faint markers on active lines
        ghostFaintRanges.push(range);
        continue;
      }
      // Rendered state: hide markers normally
      const ranges = filtered.get(decoration.type) || [];
      ranges.push(range);
      filtered.set(decoration.type, ranges);
      continue;
    }

    if (decoration.type === 'emoji') {
      const intersectsRaw = rangeIntersectsAny(range, rawRanges);
      if (intersectsRaw) {
        // Raw state: show actual shortcode
        continue;
      }

      if (decoration.emoji) {
        const ranges = filtered.get(decoration.type) || [];
        ranges.push({
          range,
          renderOptions: {
            before: {
              contentText: decoration.emoji,
            },
          },
        });
        filtered.set(decoration.type, ranges);
      }
      continue;
    }

    // Table decorations: whole-block reveal when cursor is inside the table
    if (tableTypes.has(decoration.type)) {
      if (rangeIntersectsAny(range, rawTableRanges)) {
        // Whole-block raw reveal: skip decoration so raw markdown shows
        continue;
      }
      if (decoration.replacement !== undefined) {
        const ranges = filtered.get(decoration.type) || [];
        const beforeOpts: Record<string, unknown> = {
          contentText: decoration.replacement,
        };
        if (decoration.cellStyle) {
          if (decoration.cellStyle.fontWeight) beforeOpts.fontWeight = decoration.cellStyle.fontWeight;
          if (decoration.cellStyle.fontStyle) beforeOpts.fontStyle = decoration.cellStyle.fontStyle;
          if (decoration.cellStyle.textDecoration) beforeOpts.textDecoration = decoration.cellStyle.textDecoration;
        }
        ranges.push({
          range,
          renderOptions: {
            before: beforeOpts,
          },
        });
        filtered.set(decoration.type, ranges);
      }
      continue;
    }

    if (isMarkerDecorationType(decoration.type)) {
      const intersectsRaw = rangeIntersectsAny(range, rawRanges);

      if (intersectsRaw) {
        // Raw state: skip marker decorations (show actual syntax)
        continue;
      }
      if (isActiveLine) {
        // Ghost state: show faint markers on active lines
        ghostFaintRanges.push(range);
        continue;
      }
      // Rendered state: apply marker decorations normally
    }

    // Add to appropriate type array
    const ranges = filtered.get(decoration.type) || [];
    ranges.push(range);
    filtered.set(decoration.type, ranges);
  }

  if (ghostFaintRanges.length > 0) {
    filtered.set('ghostFaint', ghostFaintRanges);
  }

  if (selectionOverlayRanges.length > 0) {
    filtered.set('selectionOverlay', mergeRanges(selectionOverlayRanges));
  }

  return filtered;
}

function collectRawRanges(selectedRanges: Range[], scopes: ScopeEntry[]): Range[] {
  if (selectedRanges.length === 0 || scopes.length === 0) {
    return [];
  }

  const rawRanges: Range[] = [];
  for (const selection of selectedRanges) {
    for (const scope of scopes) {
      const intersection = selection.intersection(scope.range);
      if (intersection !== undefined) {
        rawRanges.push(scope.range);
      }
    }
  }

  return rawRanges;
}

function collectCursorScopeRanges(cursorPositions: Position[], scopes: ScopeEntry[]): Range[] {
  if (cursorPositions.length === 0 || scopes.length === 0) {
    return [];
  }

  const cursorRanges: Range[] = [];
  for (const position of cursorPositions) {
    // Check if cursor is inside scope or at its boundaries (start or end)
    // Range.contains() uses exclusive end, so we also check if position equals start or end
    const matchingScopes = scopes.filter((scope) => {
      const isInside = scope.range.contains(position);
      const isAtStart = position.line === scope.range.start.line &&
                        position.character === scope.range.start.character;
      const isAtEnd = position.line === scope.range.end.line &&
                      position.character === scope.range.end.character;
      return isInside || isAtStart || isAtEnd;
    });

    if (matchingScopes.length === 0) {
      continue;
    }

    const smallestScope = matchingScopes.reduce((smallest, scope) => {
      if (!smallest) {
        return scope;
      }
      const smallestLength = smallest.endPos - smallest.startPos;
      const scopeLength = scope.endPos - scope.startPos;
      return scopeLength < smallestLength ? scope : smallest;
    }, undefined as ScopeEntry | undefined);

    if (smallestScope) {
      cursorRanges.push(smallestScope.range);
    }
  }

  return cursorRanges;
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) {
    return [];
  }

  const sorted = [...ranges].sort((a, b) => {
    if (a.start.line !== b.start.line) {
      return a.start.line - b.start.line;
    }
    return a.start.character - b.start.character;
  });

  const merged: Range[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start.isBeforeOrEqual(last.end) && current.end.isAfterOrEqual(last.start)) {
      merged[merged.length - 1] = new Range(
        last.start,
        current.end.isAfter(last.end) ? current.end : last.end
      );
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function rangeIntersectsAny(range: Range, ranges: Range[]): boolean {
  return ranges.some((candidate) => {
    const intersection = range.intersection(candidate);
    return intersection !== undefined;
  });
}
