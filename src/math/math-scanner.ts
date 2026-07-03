/**
 * Scans normalized document text for inline ($...$) and block ($$...$$) math regions.
 * Positions are in normalized text (LF line endings). Block has precedence over inline.
 * Per contract: math-delimiter-grammar.md
 */

import type { MathRegion } from '../parser';

type FencedCodeBlock = {
  startPos: number;
  endPos: number;
  contentStartPos: number;
  contentEndPos: number;
  languageToken: string;
  isMathFence: boolean;
};

type InlineCodeSpan = {
  startPos: number;
  endPos: number;
};

const MATH_FENCE_LANGUAGES = new Set(['math', 'latex', 'tex']);

/**
 * Scans text for math regions. Block math ($$...$$) is tried first; then inline ($...$).
 * Escaped \$ does not start/end; empty or whitespace-only content is not treated as math.
 * Inline: $ may have optional whitespace immediately after it and before the closing $;
 * content is trimmed and must be non-empty (so "Price is $10" still has no closing $ → no region).
 *
 * @param text - Normalized document text (LF only)
 * @returns MathRegion[] in document order, non-overlapping
 */
export function scanMathRegions(text: string): MathRegion[] {
  const fencedBlocks = scanFencedCodeBlocks(text);
  const inlineCodeSpans = scanInlineCodeSpans(text);
  const regions: MathRegion[] = [];
  let i = 0;
  const n = text.length;
  let fenceIndex = 0;
  let inlineCodeIndex = 0;

  while (i < n) {
    while (fenceIndex < fencedBlocks.length && fencedBlocks[fenceIndex].endPos <= i) {
      fenceIndex++;
    }
    const activeFence = fencedBlocks[fenceIndex];
    if (activeFence && i >= activeFence.startPos && i < activeFence.endPos) {
      i = activeFence.endPos;
      continue;
    }

    while (inlineCodeIndex < inlineCodeSpans.length && inlineCodeSpans[inlineCodeIndex].endPos <= i) {
      inlineCodeIndex++;
    }
    const activeInlineCode = inlineCodeSpans[inlineCodeIndex];
    if (activeInlineCode && i >= activeInlineCode.startPos && i < activeInlineCode.endPos) {
      i = activeInlineCode.endPos;
      continue;
    }

    // Try block first ($$...$$)
    if (text[i] === '$' && i + 1 < n && text[i + 1] === '$') {
      if (isEscaped(text, i)) {
        i++;
        continue;
      }
      const block = tryMatchBlock(text, i);
      if (block) {
        regions.push(block);
        i = block.endPos;
        continue;
      }
      // Block failed (e.g. whitespace-only content); skip both $ so we don't treat as inline
      i += 2;
      continue;
    }

    // Inline: single $ then find next unescaped $; content between is trimmed and must be non-empty
    if (text[i] === '$' && !isEscaped(text, i)) {
      const inline = tryMatchInline(text, i);
      if (inline) {
        regions.push(inline);
        i = inline.endPos;
        continue;
      }
    }

    i++;
  }

  for (const fence of fencedBlocks) {
    if (!fence.isMathFence) {
      continue;
    }
    if (fence.contentEndPos <= fence.contentStartPos) {
      continue;
    }
    const source = text.slice(fence.contentStartPos, fence.contentEndPos);
    if (source.trim().length === 0) {
      continue;
    }
    const numLines = countLines(source);
    regions.push({
      startPos: fence.startPos,
      endPos: fence.endPos,
      source,
      displayMode: true,
      numLines,
    });
  }

  regions.sort((a, b) => a.startPos - b.startPos);
  return regions;
}

function isEscaped(text: string, dollarIndex: number): boolean {
  let backslashes = 0;
  let p = dollarIndex - 1;
  while (p >= 0 && text[p] === '\\') {
    backslashes++;
    p--;
  }
  return backslashes % 2 === 1;
}

function tryMatchBlock(text: string, start: number): MathRegion | null {
  if (start + 4 > text.length) return null;
  if (text[start] !== '$' || text[start + 1] !== '$') return null;
  let i = start + 2;
  while (i < text.length) {
    const idx = text.indexOf('$$', i);
    if (idx === -1) return null;
    if (isEscapedAt(text, idx)) {
      i = idx + 1;
      continue;
    }
    const content = text.slice(start + 2, idx).trim();
    if (content.length === 0) {
      i = idx + 2;
      continue;
    }
    return {
      startPos: start,
      endPos: idx + 2,
      source: text.slice(start + 2, idx).trim(),
      displayMode: true,
    };
  }
  return null;
}

function isEscapedAt(text: string, idx: number): boolean {
  if (idx <= 0) return false;
  let backslashes = 0;
  let p = idx - 1;
  while (p >= 0 && text[p] === '\\') {
    backslashes++;
    p--;
  }
  return backslashes % 2 === 1;
}

function tryMatchInline(text: string, start: number): MathRegion | null {
  if (text[start] !== '$') return null;
  let i = start + 1;
  while (i < text.length) {
    const idx = text.indexOf('$', i);
    if (idx === -1) return null;
    if (isEscapedAt(text, idx)) {
      i = idx + 1;
      continue;
    }
    const content = text.slice(start + 1, idx).trim();
    if (content.length === 0) {
      i = idx + 1;
      continue;
    }
    return {
      startPos: start,
      endPos: idx + 1,
      source: content,
      displayMode: false,
    };
  }
  return null;
}

function scanFencedCodeBlocks(text: string): FencedCodeBlock[] {
  const blocks: FencedCodeBlock[] = [];
  let lineStart = 0;

  let openFence:
    | {
        markerChar: '`' | '~';
        markerLength: number;
        startPos: number;
        contentStartPos: number;
        languageToken: string;
      }
    | undefined;

  while (lineStart <= text.length) {
    const lineBreak = text.indexOf('\n', lineStart);
    const lineEnd = lineBreak === -1 ? text.length : lineBreak;
    const lineWithNoNewline = text.slice(lineStart, lineEnd);
    const lineEndWithNewline = lineBreak === -1 ? lineEnd : lineBreak + 1;

    if (!openFence) {
      const openingFence = parseOpeningFence(lineWithNoNewline);
      if (openingFence) {
        openFence = {
          markerChar: openingFence.markerChar,
          markerLength: openingFence.markerLength,
          startPos: lineStart,
          contentStartPos: lineEndWithNewline,
          languageToken: openingFence.languageToken,
        };
      }
    } else {
      const closingFence = parseClosingFence(lineWithNoNewline);
      if (
        closingFence &&
        closingFence.markerChar === openFence.markerChar &&
        closingFence.markerLength >= openFence.markerLength
      ) {
        blocks.push({
          startPos: openFence.startPos,
          endPos: lineEndWithNewline,
          contentStartPos: openFence.contentStartPos,
          contentEndPos: lineStart,
          languageToken: openFence.languageToken,
          isMathFence: MATH_FENCE_LANGUAGES.has(openFence.languageToken),
        });
        openFence = undefined;
      }
    }

    if (lineBreak === -1) {
      break;
    }
    lineStart = lineBreak + 1;
  }

  return blocks;
}

/**
 * Scans for CommonMark inline code spans delimited by backtick runs.
 * Opening and closing runs must be the same length or the closing run may be longer.
 */
function scanInlineCodeSpans(text: string): InlineCodeSpan[] {
  const spans: InlineCodeSpan[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] !== '`') {
      i++;
      continue;
    }

    let openLen = 0;
    let j = i;
    while (j < text.length && text[j] === '`' && openLen < 32) {
      openLen++;
      j++;
    }
    if (openLen === 0) {
      i++;
      continue;
    }

    let k = j;
    let closedAt = -1;
    while (k < text.length) {
      if (text[k] !== '`') {
        k++;
        continue;
      }
      let closeLen = 0;
      let m = k;
      while (m < text.length && text[m] === '`' && closeLen < 32) {
        closeLen++;
        m++;
      }
      if (closeLen >= openLen) {
        closedAt = m;
        break;
      }
      k = m;
    }

    if (closedAt === -1) {
      i = j;
      continue;
    }

    spans.push({ startPos: i, endPos: closedAt });
    i = closedAt;
  }

  return spans;
}

function parseOpeningFence(
  line: string
): { markerChar: '`' | '~'; markerLength: number; languageToken: string } | null {
  const match = line.match(/^[ ]{0,3}(`{3,}|~{3,})(.*)$/);
  if (!match) {
    return null;
  }
  const marker = match[1];
  const markerChar = marker[0] as '`' | '~';
  const infoString = match[2] ?? '';
  return {
    markerChar,
    markerLength: marker.length,
    languageToken: normalizeFenceLanguageToken(infoString),
  };
}

function parseClosingFence(
  line: string
): { markerChar: '`' | '~'; markerLength: number } | null {
  const match = line.match(/^[ ]{0,3}(`{3,}|~{3,})[ \t]*$/);
  if (!match) {
    return null;
  }
  const marker = match[1];
  return {
    markerChar: marker[0] as '`' | '~',
    markerLength: marker.length,
  };
}

function normalizeFenceLanguageToken(infoString: string): string {
  const trimmed = infoString.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  const [token] = trimmed.split(/\s+/, 1);
  return token ?? '';
}

/**
 * Count body lines from fence source text.
 * The body slice can include a trailing newline before the closing fence;
 * that trailing newline must not add an extra body line.
 */
function countLines(text: string): number {
  if (text.length === 0) return 1;
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') n++;
  }
  if (text.endsWith('\n')) {
    n--;
  }
  return n;
}
