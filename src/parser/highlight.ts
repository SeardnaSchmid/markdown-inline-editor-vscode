import type { DecorationRange, ScopeRange } from './types';
import { addScope } from './common';

/**
 * Scans normalized markdown text for ==highlighted text== markers.
 */
export function scanHighlightMarkers(
  text: string,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
): void {
  if (!text || text.length < 5) {
    return;
  }

  const excludedRanges = getExcludedRanges(scopes);
  const inExcludedRange = (start: number, end: number): boolean =>
    excludedRanges.some((range) => start < range.end && end > range.start);

  const n = text.length;
  let i = 0;

  while (i < n - 3) {
    if (text[i] === '=' && text[i + 1] === '=') {
      const runLength = getEqualRunLength(text, i);

      // Only even delimiter runs (2, 4) can open
      if (runLength % 2 !== 0) {
        i += runLength;
        continue;
      }

      if (isEscaped(text, i) || inExcludedRange(i, i + 2)) {
        i += runLength;
        continue;
      }

      // Left-flanking: cannot be followed by '=', whitespace, or closing punctuation
      const charAfterOpener = text[i + 2];
      if (
        charAfterOpener === '=' ||
        /\s/.test(charAfterOpener) ||
        /[.,;:)\]}]/.test(charAfterOpener)
      ) {
        i += runLength;
        continue;
      }

      const inBlockquote = isLineInBlockquote(text, i);
      let closerPos = -1;
      let j = i + 2;

      while (j < n - 1) {
        if (isBlockBoundary(text, j, inBlockquote)) {
          break;
        }

        if (text[j] === '=' && text[j + 1] === '=') {
          const closerRun = getEqualRunLength(text, j);
          if (closerRun % 2 === 0 && !isEscaped(text, j) && !inExcludedRange(j, j + 2)) {
            // Right-flanking: cannot be preceded by whitespace
            const charBeforeCloser = text[j - 1];
            if (!/\s/.test(charBeforeCloser)) {
              closerPos = j;
              break;
            }
          }
          j += closerRun;
          continue;
        }
        j++;
      }

      if (closerPos !== -1) {
        const start = i;
        const end = closerPos + 2;
        const contentStart = start + 2;
        const contentEnd = closerPos;

        if (contentStart < contentEnd) {
          decorations.push({ startPos: start, endPos: contentStart, type: 'hide' });
          decorations.push({ startPos: contentStart, endPos: contentEnd, type: 'highlight' });
          decorations.push({ startPos: contentEnd, endPos: end, type: 'hide' });
          addScope(scopes, start, end, 'highlight');
        }

        // For runs of 4 (==A====B==), advance by 2 so remaining 2 can open next highlight
        i = closerPos + 2;
        continue;
      }
    }

    i++;
  }
}

function isBlockBoundary(text: string, pos: number, inBlockquote: boolean): boolean {
  if (text[pos] !== '\n' && (text[pos] !== '\r' || text[pos + 1] !== '\n')) {
    return false;
  }
  let p = text[pos] === '\r' ? pos + 2 : pos + 1;
  while (p < text.length && (text[p] === ' ' || text[p] === '\t')) {
    p++;
  }

  // Blank line (paragraph break)
  if (p >= text.length || text[p] === '\n' || text[p] === '\r') {
    return true;
  }

  // Unordered list item (- , * , +)
  if (
    (text[p] === '-' || text[p] === '*' || text[p] === '+') &&
    p + 1 < text.length &&
    (text[p + 1] === ' ' || text[p + 1] === '\t')
  ) {
    return true;
  }

  // Ordered list item (1. , 1) )
  if (/\d/.test(text[p])) {
    let numEnd = p;
    while (numEnd < text.length && /\d/.test(text[numEnd])) {
      numEnd++;
    }
    if (
      numEnd < text.length &&
      (text[numEnd] === '.' || text[numEnd] === ')') &&
      numEnd + 1 < text.length &&
      (text[numEnd + 1] === ' ' || text[numEnd + 1] === '\t')
    ) {
      return true;
    }
  }

  // Heading (1-6 '#' followed by space/tab)
  if (text[p] === '#') {
    let hEnd = p;
    while (hEnd < text.length && text[hEnd] === '#') {
      hEnd++;
    }
    if (hEnd - p <= 6 && hEnd < text.length && (text[hEnd] === ' ' || text[hEnd] === '\t')) {
      return true;
    }
  }

  // Blockquote entry from outside blockquote
  if (text[p] === '>' && !inBlockquote) {
    return true;
  }

  // Fenced code block or thematic break
  if (p + 2 < text.length) {
    const fence = text.slice(p, p + 3);
    if (fence === '```' || fence === '~~~' || fence === '---') {
      return true;
    }
  }

  // Table row
  return text[p] === '|';
}

function getEqualRunLength(text: string, pos: number): number {
  let len = 0;
  while (pos + len < text.length && text[pos + len] === '=') {
    len++;
  }
  return len;
}

function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  let i = index - 1;
  while (i >= 0 && text[i] === '\\') {
    backslashCount++;
    i--;
  }
  return backslashCount % 2 === 1;
}

function getExcludedRanges(scopes: ScopeRange[]): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const scope of scopes) {
    if (scope.kind === 'codeBlock' || scope.kind === 'code' || scope.kind === 'frontmatter') {
      out.push({ start: scope.startPos, end: scope.endPos });
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

function isLineInBlockquote(text: string, pos: number): boolean {
  const lineStart = pos === 0 ? 0 : text.lastIndexOf('\n', pos - 1) + 1;
  let p = lineStart;
  while (p < pos && (text[p] === ' ' || text[p] === '\t')) {
    p++;
  }
  return p < pos && text[p] === '>';
}
