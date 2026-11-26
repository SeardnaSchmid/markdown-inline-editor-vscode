import type { TextDocument } from 'vscode';
import type { ParseEntry } from '../markdown-parse-cache';
import type { DecorationType } from '../parser';
import { mapNormalizedToOriginal } from '../position-mapping';

export interface OffsetRange {
  start: number;
  end: number;
}

export interface ProtectedMarker extends OffsetRange {
  type: DecorationType;
  isLinePrefix: boolean;
  isAtomic: boolean;
  isCheckbox: boolean;
  isTableBoundary: boolean;
}

export interface InlineConstruct extends OffsetRange {
  kind: string;
  markers: OffsetRange[];
  contentStart: number;
  contentEnd: number;
}

export interface RenderedEditMap {
  /** Individual mapped marker ranges (excluding active raw fallback blocks). */
  rawMarkers: ProtectedMarker[];
  /** Adjacent non-atomic markers merged for single-step cursor jumping. */
  mergedMarkers: ProtectedMarker[];
  /** Inline constructs with their opening/closing markers and visible content span. */
  constructs: InlineConstruct[];
  /** Mermaid blocks and Math regions that fall back to native raw editing. */
  rawFallbackBlocks: OffsetRange[];
  /** Editable content spans [trimStart, trimEnd] of table cells grouped by 0-based line number. */
  tableCellsByLine: Map<number, OffsetRange[]>;
  /** 0-based line numbers of table separator rows (`|---|---|`) where the caret must not stop. */
  tableSeparatorLines: Set<number>;
}

const LINE_PREFIX_TYPES = new Set<DecorationType>([
  'listItem',
  'orderedListItem',
  'blockquote',
  'checkboxMarker',
  'checkboxUnchecked',
  'checkboxChecked',
]);

const CHECKBOX_TYPES = new Set<DecorationType>([
  'checkboxMarker',
  'checkboxUnchecked',
  'checkboxChecked',
]);

const ATOMIC_TYPES = new Set<DecorationType>(['emoji', 'horizontalRule']);

const TABLE_SEPARATOR_TYPES = new Set<DecorationType>([
  'tableSeparatorPipe',
  'tableSeparatorDash',
  'tableRule',
]);

const INLINE_MARKER_TYPES = new Set<DecorationType>([
  'hide',
  'transparent',
  'frontmatterDelimiter',
]);

const INLINE_CONSTRUCT_KINDS = new Set<string>([
  'bold',
  'italic',
  'boldItalic',
  'strikethrough',
  'highlight',
  'code',
  'link',
  'image',
]);

export function buildRenderedEditMap(
  document: TextDocument,
  entry: ParseEntry
): RenderedEditMap {
  const originalText = entry.text;
  const docLen = document.getText().length;

  const mapRange = (startPos: number, endPos: number): OffsetRange | null => {
    const start = Math.max(0, Math.min(docLen, mapNormalizedToOriginal(startPos, originalText)));
    const end = Math.max(0, Math.min(docLen, mapNormalizedToOriginal(endPos, originalText)));
    if (start >= end) {
      return null;
    }
    return { start, end };
  };

  const rawFallbackBlocks: OffsetRange[] = [];
  for (const block of entry.mermaidBlocks) {
    const r = mapRange(block.startPos, block.endPos);
    if (r) rawFallbackBlocks.push(r);
  }
  for (const region of entry.mathRegions) {
    const r = mapRange(region.startPos, region.endPos);
    if (r) rawFallbackBlocks.push(r);
  }

  const overlapsRawBlock = (start: number, end: number): boolean =>
    rawFallbackBlocks.some((b) => start < b.end && end > b.start);

  const headingStarts = new Set<number>();
  for (const scope of entry.scopes) {
    if (scope.kind === 'heading') {
      const mappedStart = mapNormalizedToOriginal(scope.startPos, originalText);
      headingStarts.add(mappedStart);
    }
  }

  const docText = document.getText();
  const rawMarkers: ProtectedMarker[] = [];
  const tableCellsByLine = new Map<number, OffsetRange[]>();
  const tableSeparatorLines = new Set<number>();

  const pushMarker = (
    start: number,
    end: number,
    type: DecorationType,
    flags?: Partial<Pick<ProtectedMarker, 'isLinePrefix' | 'isAtomic' | 'isCheckbox' | 'isTableBoundary'>>
  ): void => {
    if (start >= end) return;
    rawMarkers.push({
      start,
      end,
      type,
      isLinePrefix: flags?.isLinePrefix ?? false,
      isAtomic: flags?.isAtomic ?? false,
      isCheckbox: flags?.isCheckbox ?? false,
      isTableBoundary: flags?.isTableBoundary ?? false,
    });
  };

  for (const dec of entry.decorations) {
    if (dec.type === 'tableCell') {
      const r = mapRange(dec.startPos, dec.endPos);
      if (!r || overlapsRawBlock(r.start, r.end)) continue;

      let trimStart = r.start;
      while (trimStart < r.end && (docText[trimStart] === ' ' || docText[trimStart] === '\t')) {
        trimStart++;
      }
      let trimEnd = r.end;
      while (trimEnd > trimStart && (docText[trimEnd - 1] === ' ' || docText[trimEnd - 1] === '\t')) {
        trimEnd--;
      }

      const line = document.positionAt(r.start).line;
      const lineCells = tableCellsByLine.get(line) ?? [];
      if (trimStart === trimEnd) {
        lineCells.push({ start: r.start, end: r.start });
        // Empty cell: hide padding after cellStart so caret at cellStart stays inside the cell.
        pushMarker(r.start + 1, r.end, 'hide');
      } else {
        lineCells.push({ start: trimStart, end: trimEnd });
        pushMarker(r.start, trimStart, 'hide');
        pushMarker(trimEnd, r.end, 'hide');
      }
      tableCellsByLine.set(line, lineCells);
      continue;
    }

    if (dec.type === 'tablePipe') {
      const r = mapRange(dec.startPos, dec.endPos);
      if (r && !overlapsRawBlock(r.start, r.end)) {
        pushMarker(r.start, r.end, dec.type, { isAtomic: true, isTableBoundary: true });
      }
      continue;
    }

    if (TABLE_SEPARATOR_TYPES.has(dec.type)) {
      const r = mapRange(dec.startPos, dec.endPos);
      if (r && !overlapsRawBlock(r.start, r.end)) {
        tableSeparatorLines.add(document.positionAt(r.start).line);
        pushMarker(r.start, r.end, dec.type, { isLinePrefix: true, isTableBoundary: true });
      }
      continue;
    }

    const isLinePrefixType = LINE_PREFIX_TYPES.has(dec.type);
    const isAtomic = ATOMIC_TYPES.has(dec.type);
    const isInlineMarker = INLINE_MARKER_TYPES.has(dec.type);
    if (!isLinePrefixType && !isAtomic && !isInlineMarker) continue;

    const r = mapRange(dec.startPos, dec.endPos);
    if (!r || overlapsRawBlock(r.start, r.end)) continue;

    const isHeadingPrefix = dec.type === 'hide' && headingStarts.has(r.start);
    pushMarker(r.start, r.end, dec.type, {
      isLinePrefix: isLinePrefixType || isHeadingPrefix,
      isAtomic,
      isCheckbox: CHECKBOX_TYPES.has(dec.type),
    });
  }

  rawMarkers.sort((a, b) => (a.start !== b.start ? a.start - b.start : a.end - b.end));

  const mergedMarkers: ProtectedMarker[] = [];
  for (const m of rawMarkers) {
    const prev = mergedMarkers[mergedMarkers.length - 1];
    if (
      prev &&
      !prev.isAtomic &&
      !m.isAtomic &&
      m.start <= prev.end &&
      prev.isLinePrefix === m.isLinePrefix &&
      prev.isTableBoundary === m.isTableBoundary
    ) {
      prev.end = Math.max(prev.end, m.end);
      prev.isCheckbox = prev.isCheckbox || m.isCheckbox;
    } else {
      mergedMarkers.push({ ...m });
    }
  }

  const constructs: InlineConstruct[] = [];
  for (const scope of entry.scopes) {
    if (!scope.kind || !INLINE_CONSTRUCT_KINDS.has(scope.kind)) {
      continue;
    }
    const r = mapRange(scope.startPos, scope.endPos);
    if (!r || overlapsRawBlock(r.start, r.end)) {
      continue;
    }

    // Collect markers at the opening edge (contiguous from r.start)
    // and closing edge (contiguous back from r.end).
    const insideMarkers = rawMarkers.filter(
      (m) => !m.isAtomic && m.start >= r.start && m.end <= r.end
    );
    if (insideMarkers.length === 0) {
      continue;
    }

    let contentStart = r.start;
    const ownedMarkers: OffsetRange[] = [];
    for (const m of insideMarkers) {
      if (m.start <= contentStart && m.end > contentStart && m.end < r.end) {
        ownedMarkers.push({ start: m.start, end: m.end });
        contentStart = m.end;
      }
    }

    let contentEnd = r.end;
    const closingOwned: OffsetRange[] = [];
    for (let i = insideMarkers.length - 1; i >= 0; i--) {
      const m = insideMarkers[i];
      if (m.end >= contentEnd && m.start < contentEnd && m.start >= contentStart) {
        closingOwned.push({ start: m.start, end: m.end });
        contentEnd = m.start;
      }
    }

    ownedMarkers.push(...closingOwned.reverse());
    if (ownedMarkers.length > 0 && contentStart <= contentEnd) {
      constructs.push({
        start: r.start,
        end: r.end,
        kind: scope.kind,
        markers: ownedMarkers,
        contentStart,
        contentEnd,
      });
    }
  }

  for (const cells of tableCellsByLine.values()) {
    cells.sort((a, b) => a.start - b.start);
  }

  return {
    rawMarkers,
    mergedMarkers,
    constructs,
    rawFallbackBlocks,
    tableCellsByLine,
    tableSeparatorLines,
  };
}

export function isOffsetInRawFallbackBlock(map: RenderedEditMap, offset: number): boolean {
  return map.rawFallbackBlocks.some((b) => offset >= b.start && offset <= b.end);
}

export function isRangeInRawFallbackBlock(
  map: RenderedEditMap,
  start: number,
  end: number
): boolean {
  if (start === end) {
    return isOffsetInRawFallbackBlock(map, start);
  }
  return map.rawFallbackBlocks.some((b) => start < b.end && end > b.start);
}

export function findMarkerStrictlyContaining(
  markers: readonly ProtectedMarker[],
  offset: number
): ProtectedMarker | undefined {
  return markers.find((m) => offset > m.start && offset < m.end);
}

export function findMarkerEndingAt(
  markers: readonly ProtectedMarker[],
  offset: number
): ProtectedMarker | undefined {
  return markers.find((m) => m.end === offset);
}

export function findMarkerStartingAt(
  markers: readonly ProtectedMarker[],
  offset: number
): ProtectedMarker | undefined {
  return markers.find((m) => m.start === offset);
}

export function mergeOffsetRanges(ranges: readonly OffsetRange[]): OffsetRange[] {
  const valid = ranges.filter((r) => r.start < r.end);
  if (valid.length === 0) {
    return [];
  }
  const sorted = [...valid].sort((a, b) => (a.start !== b.start ? a.start - b.start : a.end - b.end));
  const merged: OffsetRange[] = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}

function subtractRanges(base: readonly OffsetRange[], remove: readonly OffsetRange[]): OffsetRange[] {
  if (base.length === 0 || remove.length === 0) {
    return mergeOffsetRanges(base);
  }
  let current = mergeOffsetRanges(base);
  const removals = mergeOffsetRanges(remove);

  for (const rem of removals) {
    const next: OffsetRange[] = [];
    for (const seg of current) {
      if (rem.end <= seg.start || rem.start >= seg.end) {
        next.push(seg);
        continue;
      }
      if (rem.start > seg.start) {
        next.push({ start: seg.start, end: rem.start });
      }
      if (rem.end < seg.end) {
        next.push({ start: rem.end, end: seg.end });
      }
    }
    current = next;
  }

  return current;
}

/**
 * Expands a deletion set to also remove markers of any inline constructs whose
 * visible content becomes completely empty after applying the deletion.
 */
export function expandForEmptiedConstructs(
  map: RenderedEditMap,
  initialDeletes: readonly OffsetRange[]
): OffsetRange[] {
  let deletes = mergeOffsetRanges(initialDeletes);
  let changed = true;

  while (changed) {
    changed = false;
    for (const c of map.constructs) {
      // Skip constructs already completely covered by deletes.
      const alreadyFullyDeleted = deletes.some((d) => d.start <= c.start && d.end >= c.end);
      if (alreadyFullyDeleted) {
        continue;
      }

      // Check if any visible character inside [contentStart, contentEnd) survives.
      const innerMarkers = map.rawMarkers.filter(
        (m) => !m.isAtomic && m.start >= c.contentStart && m.end <= c.contentEnd
      );
      const remainingContent = subtractRanges(
        [{ start: c.contentStart, end: c.contentEnd }],
        [...deletes, ...innerMarkers]
      );

      if (remainingContent.length === 0 && c.contentStart < c.contentEnd) {
        // Only remove if at least part of the construct was actually touched by deletes.
        const touched = deletes.some((d) => d.start < c.contentEnd && d.end > c.contentStart);
        if (touched) {
          deletes = mergeOffsetRanges([...deletes, { start: c.start, end: c.end }]);
          changed = true;
        }
      }
    }
  }

  return deletes;
}

/**
 * Computes the exact ranges to delete when deleting a non-empty selection in Rendered Edit mode:
 * - Constructs fully covered (or whose full visible content is covered) are deleted with markers.
 * - Partially covered constructs keep their hidden markers; only visible text inside is deleted.
 * - Line-prefix markers are preserved unless the selection covers the whole line.
 */
export function computeSelectionDeletionRanges(
  document: TextDocument,
  map: RenderedEditMap,
  selStart: number,
  selEnd: number
): OffsetRange[] {
  if (selStart >= selEnd) {
    return [];
  }

  const fullDeletes: OffsetRange[] = [];
  const fullyCoveredConstructs: InlineConstruct[] = [];

  for (const c of map.constructs) {
    const coversWhole = selStart <= c.start && selEnd >= c.end;
    const coversAllVisible =
      c.contentStart < c.contentEnd && selStart <= c.contentStart && selEnd >= c.contentEnd;
    if (coversWhole || coversAllVisible) {
      fullyCoveredConstructs.push(c);
      fullDeletes.push({ start: c.start, end: c.end });
    }
  }

  const atomicDeletes: OffsetRange[] = [];
  for (const m of map.rawMarkers) {
    if (m.isAtomic && !m.isTableBoundary && selStart < m.end && selEnd > m.start) {
      atomicDeletes.push({ start: m.start, end: m.end });
    }
  }

  const protectedMarkersToKeep: OffsetRange[] = [];
  for (const m of map.rawMarkers) {
    if (m.isAtomic && !m.isTableBoundary) {
      continue;
    }
    const insideFullConstruct = fullyCoveredConstructs.some(
      (c) => m.start >= c.start && m.end <= c.end
    );
    if (insideFullConstruct) {
      continue;
    }

    if (m.isLinePrefix || m.isTableBoundary) {
      const line = document.positionAt(m.start).line;
      const lineRange = document.lineAt(line).range;
      const lineStartOffset = document.offsetAt(lineRange.start);
      const lineEndOffset = document.offsetAt(lineRange.end);
      const lineFullSelected =
        (m.isLinePrefix ? selStart <= m.end : selStart <= lineStartOffset) && selEnd > lineEndOffset;
      if (lineFullSelected) {
        // Whole line (including newline) is being deleted — delete its structural markers too.
        fullDeletes.push({ start: m.start, end: m.end });
        continue;
      }
    }

    protectedMarkersToKeep.push({ start: m.start, end: m.end });
  }

  const visibleSelectionDeletes = subtractRanges(
    [{ start: selStart, end: selEnd }],
    protectedMarkersToKeep
  );

  const combined = mergeOffsetRanges([
    ...visibleSelectionDeletes,
    ...fullDeletes,
    ...atomicDeletes,
  ]);

  return expandForEmptiedConstructs(map, combined);
}

/**
 * Computes deletion ranges for a single Backspace or Delete keypress on an empty caret.
 */
export function computeSingleCharDeletionRanges(
  document: TextDocument,
  map: RenderedEditMap,
  offset: number,
  direction: 'backward' | 'forward'
): OffsetRange[] {
  const text = document.getText();

  if (direction === 'backward') {
    let pos = offset;
    while (pos > 0) {
      const markerBefore = findMarkerEndingAt(map.mergedMarkers, pos);
      if (!markerBefore) {
        break;
      }
      if (markerBefore.isLinePrefix || markerBefore.isTableBoundary) {
        // Protect line-prefix markers and table structural boundaries (|, separator row).
        return [];
      }
      if (markerBefore.isAtomic) {
        return expandForEmptiedConstructs(map, [
          { start: markerBefore.start, end: markerBefore.end },
        ]);
      }
      pos = markerBefore.start;
    }

    if (pos <= 0) {
      return [];
    }

    const delStart = pos >= 2 && text[pos - 1] === '\n' && text[pos - 2] === '\r' ? pos - 2 : pos - 1;

    // Guard against slicing into a protected marker (e.g. closing code fence or table pipe).
    const hitMarker = findMarkerStrictlyContaining(map.mergedMarkers, delStart);
    if (hitMarker) {
      return [];
    }

    return expandForEmptiedConstructs(map, [{ start: delStart, end: pos }]);
  }

  // direction === 'forward'
  let pos = offset;
  while (pos < text.length) {
    const markerAfter = findMarkerStartingAt(map.mergedMarkers, pos);
    if (!markerAfter) {
      break;
    }
    if (markerAfter.isLinePrefix || markerAfter.isTableBoundary) {
      return [];
    }
    if (markerAfter.isAtomic) {
      return expandForEmptiedConstructs(map, [
        { start: markerAfter.start, end: markerAfter.end },
      ]);
    }
    pos = markerAfter.end;
  }

  if (pos >= text.length) {
    return [];
  }

  const delEnd =
    pos + 1 < text.length && text[pos] === '\r' && text[pos + 1] === '\n' ? pos + 2 : pos + 1;

  const hitMarker = findMarkerStrictlyContaining(map.mergedMarkers, delEnd);
  if (hitMarker) {
    return [];
  }

  return expandForEmptiedConstructs(map, [{ start: pos, end: delEnd }]);
}

interface VisibleReplacementSegment {
  start: number;
  end: number;
  replacement: string;
}

/**
 * Extracts only the visually rendered text for [selStart, selEnd), stripping hidden
 * Markdown syntax markers and substituting visual replacements (`• `, `1. `, `☐`/`☑`, emoji).
 * Raw fallback blocks (tables, Mermaid, math) are left as-is.
 */
export function extractVisibleText(
  document: TextDocument,
  entry: ParseEntry,
  map: RenderedEditMap,
  selStart: number,
  selEnd: number
): string {
  if (selStart >= selEnd) {
    return '';
  }

  const text = document.getText();
  const docLen = text.length;
  const originalText = entry.text;

  const overlapsRawBlock = (start: number, end: number): boolean =>
    map.rawFallbackBlocks.some((b) => start < b.end && end > b.start);

  const segments: VisibleReplacementSegment[] = [];

  for (const dec of entry.decorations) {
    if (dec.type === 'tableCell') {
      const start = Math.max(0, Math.min(docLen, mapNormalizedToOriginal(dec.startPos, originalText)));
      const end = Math.max(0, Math.min(docLen, mapNormalizedToOriginal(dec.endPos, originalText)));
      if (start >= end || end <= selStart || start >= selEnd || overlapsRawBlock(start, end)) {
        continue;
      }
      let trimStart = start;
      while (trimStart < end && (text[trimStart] === ' ' || text[trimStart] === '\t')) {
        trimStart++;
      }
      let trimEnd = end;
      while (trimEnd > trimStart && (text[trimEnd - 1] === ' ' || text[trimEnd - 1] === '\t')) {
        trimEnd--;
      }
      if (trimStart > start) {
        segments.push({ start, end: trimStart, replacement: '' });
      }
      if (trimEnd < end) {
        segments.push({ start: trimEnd, end, replacement: '' });
      }
      continue;
    }

    if (dec.type === 'tablePipe') {
      const start = Math.max(0, Math.min(docLen, mapNormalizedToOriginal(dec.startPos, originalText)));
      const end = Math.max(0, Math.min(docLen, mapNormalizedToOriginal(dec.endPos, originalText)));
      if (start >= end || end <= selStart || start >= selEnd || overlapsRawBlock(start, end)) {
        continue;
      }
      const line = document.positionAt(start).line;
      const lineText = document.lineAt(line).text;
      const lineStartOff = document.offsetAt(document.lineAt(line).range.start);
      const beforeOnLine = lineText.slice(0, start - lineStartOff).trim();
      const afterOnLine = lineText.slice(end - lineStartOff).trim();
      const isInnerPipe = beforeOnLine.length > 0 && afterOnLine.length > 0;
      segments.push({ start, end, replacement: isInnerPipe ? '\t' : '' });
      continue;
    }

    let replacement: string | undefined;
    switch (dec.type) {
      case 'hide':
      case 'transparent':
      case 'checkboxMarker':
      case 'frontmatterDelimiter':
      case 'blockquote':
      case 'horizontalRule':
      case 'tableSeparatorPipe':
      case 'tableSeparatorDash':
      case 'tableRule':
        replacement = '';
        break;
      case 'listItem':
        replacement = '• ';
        break;
      case 'orderedListItem':
        replacement = dec.replacement ?? '';
        break;
      case 'checkboxUnchecked':
        replacement = '☐';
        break;
      case 'checkboxChecked':
        replacement = '☑';
        break;
      case 'emoji':
        replacement = dec.emoji ?? '';
        break;
      default:
        break;
    }

    if (replacement === undefined) {
      continue;
    }

    const start = Math.max(0, Math.min(docLen, mapNormalizedToOriginal(dec.startPos, originalText)));
    const end = Math.max(0, Math.min(docLen, mapNormalizedToOriginal(dec.endPos, originalText)));
    if (start >= end || end <= selStart || start >= selEnd) {
      continue;
    }
    if (overlapsRawBlock(start, end)) {
      continue;
    }

    segments.push({ start, end, replacement });
  }

  segments.sort((a, b) => (a.start !== b.start ? a.start - b.start : b.end - a.end));

  let result = '';
  let cursor = selStart;

  for (const seg of segments) {
    if (seg.end <= cursor) {
      continue;
    }
    if (seg.start > cursor) {
      result += text.slice(cursor, Math.min(seg.start, selEnd));
    }
    if (seg.replacement.length > 0 && seg.start >= selStart) {
      result += seg.replacement;
    }
    cursor = Math.max(cursor, Math.min(seg.end, selEnd));
  }

  if (cursor < selEnd) {
    result += text.slice(cursor, selEnd);
  }

  return result;
}

const WORD_CHAR_REGEX = /[\p{L}\p{N}_]/u;

/**
 * Finds the next/previous word boundary over visible characters, skipping hidden syntax markers.
 */
export function findVisibleWordBoundary(
  text: string,
  map: RenderedEditMap,
  offset: number,
  direction: 'backward' | 'forward'
): number {
  let pos = offset;

  if (direction === 'backward') {
    const inside = findMarkerStrictlyContaining(map.mergedMarkers, pos);
    if (inside) {
      pos = inside.isLinePrefix ? inside.end : inside.start;
    }

    const skipMarkersLeft = (): boolean => {
      while (pos > 0) {
        const m = findMarkerEndingAt(map.mergedMarkers, pos);
        if (!m) return true;
        if (m.isLinePrefix && m.start === 0) return false;
        if (m.isAtomic) return false;
        pos = m.start;
      }
      return pos > 0;
    };

    if (!skipMarkersLeft()) return pos;

    while (pos > 0) {
      if (!skipMarkersLeft()) return pos;
      const ch = text[pos - 1];
      if (ch === ' ' || ch === '\t') {
        pos--;
      } else {
        break;
      }
    }

    if (pos <= 0 || !skipMarkersLeft()) return pos;
    const firstChar = text[pos - 1];
    if (firstChar === '\n' || firstChar === '\r') {
      return pos === offset
        ? pos >= 2 && text[pos - 1] === '\n' && text[pos - 2] === '\r'
          ? pos - 2
          : pos - 1
        : pos;
    }

    const isWord = WORD_CHAR_REGEX.test(firstChar);
    while (pos > 0) {
      if (!skipMarkersLeft()) return pos;
      const ch = text[pos - 1];
      if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') break;
      if (WORD_CHAR_REGEX.test(ch) !== isWord) break;
      pos--;
    }
    return pos;
  }

  // direction === 'forward'
  const inside = findMarkerStrictlyContaining(map.mergedMarkers, pos);
  if (inside) {
    pos = inside.end;
  }

  const skipMarkersRight = (): boolean => {
    while (pos < text.length) {
      const m = findMarkerStartingAt(map.mergedMarkers, pos);
      if (!m) return true;
      if (m.isAtomic) return false;
      pos = m.end;
    }
    return pos < text.length;
  };

  if (!skipMarkersRight()) return pos;

  while (pos < text.length) {
    if (!skipMarkersRight()) return pos;
    const ch = text[pos];
    if (ch === ' ' || ch === '\t') {
      pos++;
    } else {
      break;
    }
  }

  if (pos >= text.length || !skipMarkersRight()) return pos;
  const firstChar = text[pos];
  if (firstChar === '\n' || firstChar === '\r') {
    if (pos === offset) {
      pos += pos + 1 < text.length && text[pos] === '\r' && text[pos + 1] === '\n' ? 2 : 1;
      while (pos < text.length) {
        const prefix = findMarkerStartingAt(map.mergedMarkers, pos);
        if (!prefix || !prefix.isLinePrefix) break;
        pos = prefix.end;
      }
    }
    return pos;
  }

  const isWord = WORD_CHAR_REGEX.test(firstChar);
  while (pos < text.length) {
    if (!skipMarkersRight()) return pos;
    const ch = text[pos];
    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') break;
    if (WORD_CHAR_REGEX.test(ch) !== isWord) break;
    pos++;
  }
  return pos;
}
