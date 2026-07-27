import type {
  Delete,
  Emphasis,
  InlineCode,
  Node,
  Strong,
  Table,
  TableCell,
  Text,
} from 'mdast';
import type { ScopeRange } from './types';
import { addScope } from './common';

export function extractCellPlainText(cell: TableCell): string {
  const walk = (node: Node): string => {
    switch (node.type) {
      case 'text':
        return (node as Text).value;
      case 'inlineCode':
        return (node as InlineCode).value;
      case 'strong':
      case 'emphasis':
      case 'delete': {
        const parent = node as Strong | Emphasis | Delete;
        return parent.children.map(walk).join('');
      }
      default: {
        const asParent = node as { children?: Node[] };
        return asParent.children ? asParent.children.map(walk).join('') : '';
      }
    }
  };

  return cell.children.map(walk).join('');
}

export function cellHasMixedFormatting(cell: TableCell): boolean {
  return cell.children.some((child) =>
    child.type === 'strong' || child.type === 'emphasis' ||
    child.type === 'delete' || child.type === 'inlineCode'
  );
}

export function detectCellStyle(
  trimmed: string,
): { fontWeight?: string; fontStyle?: string; textDecoration?: string } | undefined {
  if (
    (trimmed.startsWith('***') && trimmed.endsWith('***')) ||
    (trimmed.startsWith('___') && trimmed.endsWith('___'))
  ) {
    return { fontWeight: 'bold', fontStyle: 'italic' };
  }
  if (
    (trimmed.startsWith('**') && trimmed.endsWith('**')) ||
    (trimmed.startsWith('__') && trimmed.endsWith('__'))
  ) {
    return { fontWeight: 'bold' };
  }
  if (trimmed.startsWith('~~') && trimmed.endsWith('~~')) {
    return { textDecoration: 'line-through' };
  }
  if (
    (trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 2) ||
    (trimmed.startsWith('_') && trimmed.endsWith('_') && trimmed.length > 2)
  ) {
    return { fontStyle: 'italic' };
  }
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 2) {
    return { fontWeight: 'normal' };
  }
  return undefined;
}

/**
 * Display width of a full-width character relative to an ASCII character, used when the
 * caller does not supply one. 2 matches fonts where a full-width glyph occupies exactly
 * two half-width cells.
 */
export const DEFAULT_CJK_WIDTH_RATIO = 2;

/**
 * Horizontal padding inside a preview-style cell box, in character widths. It stands in
 * for the hidden `|` and keeps neighbouring columns from touching.
 */
export const CELL_PADDING_CH = 1;

/** Options controlling how column widths are estimated. */
export interface TableWidthOptions {
  /** Display width of a full-width character, relative to an ASCII character. */
  cjkWidthRatio?: number;
  /** Upper bound for a single column, in character widths. */
  maxColumnWidth?: number;
}

/**
 * Reports whether a code point is rendered full-width (East Asian Wide / Fullwidth).
 *
 * Covers kana, CJK ideographs, Hangul, CJK punctuation and the fullwidth forms block —
 * the last one matters for Japanese text, where `（` and `）` are common.
 *
 * @param {number} code - Unicode code point
 * @returns {boolean} True when the character occupies two character cells
 */
export function isFullWidth(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x9fff) || // CJK radicals, kana, punctuation, unified ideographs
    (code >= 0xa960 && code <= 0xa97f) || // Hangul Jamo Extended-A
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility ideographs
    (code >= 0xfe10 && code <= 0xfe19) || // Vertical forms
    (code >= 0xfe30 && code <= 0xfe6f) || // CJK compatibility forms, small form variants
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth forms, e.g. fullwidth parentheses
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth signs
    (code >= 0x20000 && code <= 0x2fa1f) // CJK extension B and beyond
  );
}

/**
 * Estimates the display width of a string in character widths (ASCII character = 1).
 *
 * @param {string} plain - Text to measure
 * @param {number} cjkWidthRatio - Width of a full-width character relative to an ASCII one
 * @returns {number} Estimated width, possibly fractional
 */
export function measureTextWidth(
  plain: string,
  cjkWidthRatio: number = DEFAULT_CJK_WIDTH_RATIO,
): number {
  let width = 0;
  for (const char of plain) {
    width += isFullWidth(char.codePointAt(0)!) ? cjkWidthRatio : 1;
  }
  return width;
}

export function findPipePositions(
  text: string,
  lineStart: number,
  lineEnd: number,
): number[] {
  const pipes: number[] = [];
  for (let i = lineStart; i < lineEnd; i++) {
    if (text[i] === '|') {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= lineStart && text[j] === '\\') {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 0) {
        pipes.push(i);
      }
    }
  }
  return pipes;
}

export function normalizePipePositions(
  text: string,
  lineStart: number,
  trimmedLineEnd: number,
  pipes: number[],
): { positions: number[]; isVirtual: boolean[] } {
  if (pipes.length === 0) {
    return { positions: pipes, isVirtual: [] };
  }

  const positions = [...pipes];
  const isVirtual = new Array(pipes.length).fill(false);

  let firstContentPos = lineStart;
  while (firstContentPos < trimmedLineEnd && (text[firstContentPos] === ' ' || text[firstContentPos] === '\t')) {
    firstContentPos++;
  }

  if (pipes[0] !== firstContentPos) {
    const virtualLead = firstContentPos > lineStart ? firstContentPos - 1 : -1;
    positions.unshift(virtualLead);
    isVirtual.unshift(true);
  }

  if (pipes[pipes.length - 1] < trimmedLineEnd - 1) {
    positions.push(trimmedLineEnd);
    isVirtual.push(true);
  }

  return { positions, isVirtual };
}

export function getLineRange(text: string, offset: number): [number, number] {
  const lineStart = offset === 0 ? 0 : text.lastIndexOf('\n', offset - 1) + 1;
  let lineEnd = text.indexOf('\n', offset);
  if (lineEnd === -1) lineEnd = text.length;
  return [lineStart, lineEnd];
}

export function trimLineEnd(text: string, lineStart: number, lineEnd: number): number {
  let end = lineEnd;
  while (
    end > lineStart &&
    (text[end - 1] === ' ' || text[end - 1] === '\t')
  ) {
    end--;
  }
  return end;
}

export function computeColumnWidths(
  tableNode: Table,
  source: string,
  options: TableWidthOptions = {},
): number[] {
  const cjkWidthRatio = options.cjkWidthRatio ?? DEFAULT_CJK_WIDTH_RATIO;
  const maxColumnWidth = options.maxColumnWidth ?? Number.POSITIVE_INFINITY;
  let numCols = 0;

  for (const row of tableNode.children) {
    if (!row.position || row.position.start.offset === undefined) continue;
    const [lineStart, lineEnd] = getLineRange(source, row.position.start.offset);
    const trimmed = trimLineEnd(source, lineStart, lineEnd);
    const rawPipes = findPipePositions(source, lineStart, trimmed);
    const { positions: pipes } = normalizePipePositions(source, lineStart, trimmed, rawPipes);
    const cellCount = Math.max(0, pipes.length - 1);
    if (cellCount > numCols) numCols = cellCount;
  }

  const widths: number[] = new Array(numCols).fill(3);

  for (const row of tableNode.children) {
    if (!row.position || row.position.start.offset === undefined) continue;
    const [lineStart, lineEnd] = getLineRange(source, row.position.start.offset);
    const trimmed = trimLineEnd(source, lineStart, lineEnd);
    const rawPipes = findPipePositions(source, lineStart, trimmed);
    const { positions: pipes } = normalizePipePositions(source, lineStart, trimmed, rawPipes);

    for (let i = 0; i < pipes.length - 1 && i < numCols; i++) {
      const cellText = source.substring(pipes[i] + 1, pipes[i + 1]).trim();
      const astCell = i < row.children.length ? row.children[i] as TableCell : undefined;
      const cellStyle = detectCellStyle(cellText);
      const showRaw = !cellStyle && astCell && cellHasMixedFormatting(astCell);
      const displayText = (astCell && !showRaw)
        ? extractCellPlainText(astCell)
        : cellText;
      const width = measureTextWidth(displayText, cjkWidthRatio);
      if (width > widths[i]) widths[i] = width;
    }
  }

  return widths.map((width) => Math.min(maxColumnWidth, Math.ceil(width)));
}

export function addTableScope(scopes: ScopeRange[], tableStart: number, tableEnd: number): void {
  addScope(scopes, tableStart, tableEnd, 'table');
}
