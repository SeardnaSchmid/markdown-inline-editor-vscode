import type { Code } from 'mdast';
import { addScope, hasValidPosition } from './common';
import type { DecorationRange, MermaidBlock, ScopeRange } from './types';

type FenceMatch = {
  fenceStart: number;
  fenceChar: string;
  fenceLength: number;
};

const MAX_FENCE_SEARCH_LINES = 20;

export function processCodeBlock(
  node: Code,
  text: string,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
  mermaidBlocks: MermaidBlock[],
): void {
  if (!hasValidPosition(node)) {
    return;
  }

  const codeStart = node.position!.start.offset!;
  const codeEnd = node.position!.end.offset!;
  const openingFence = findOpeningFence(text, codeStart);
  if (!openingFence) {
    return;
  }

  const { fenceStart, fenceChar, fenceLength } = openingFence;
  const closingFence = findClosingFence(text, codeEnd, fenceChar, fenceLength, fenceStart);
  if (closingFence === -1 || closingFence <= fenceStart) {
    return;
  }

  const openingLineEnd = text.indexOf('\n', fenceStart);
  const openingFenceEnd = fenceStart + fenceLength;
  const closingFenceEnd = closingFence + fenceLength;
  const closingLineEnd = text.indexOf('\n', closingFence);
  const closingEnd = closingLineEnd !== -1 ? closingLineEnd + 1 : codeEnd;
  const isMermaid = node.lang?.trim() === 'mermaid';

  if (!isMermaid) {
    decorations.push({
      startPos: fenceStart,
      endPos: closingFenceEnd,
      type: 'codeBlock',
    });
    decorations.push({
      startPos: fenceStart,
      endPos: openingFenceEnd,
      type: 'hide',
    });

    const languageStart = openingFenceEnd;
    const languageEnd =
      openingLineEnd !== -1 && openingLineEnd < closingFence
        ? openingLineEnd
        : openingFenceEnd;

    if (languageEnd > languageStart) {
      const languageText = text.substring(languageStart, languageEnd).trim();
      if (languageText.length > 0) {
        decorations.push({
          startPos: languageStart,
          endPos: languageEnd,
          type: 'codeBlockLanguage',
        });
      }
    }

    if (openingLineEnd !== -1 && openingLineEnd < closingFence) {
      decorations.push({
        startPos: openingLineEnd,
        endPos: openingLineEnd + 1,
        type: 'hide',
      });
    }

    decorations.push({
      startPos: closingFence,
      endPos: closingEnd,
      type: 'hide',
    });
  } else {
    decorations.push({
      startPos: fenceStart,
      endPos: openingFenceEnd,
      type: 'hide',
    });

    const languageStart = openingFenceEnd;
    const languageEnd =
      openingLineEnd !== -1 && openingLineEnd < closingFence
        ? openingLineEnd
        : openingFenceEnd;

    if (languageEnd > languageStart) {
      decorations.push({
        startPos: languageStart,
        endPos: languageEnd,
        type: 'hide',
      });
    }

    if (openingLineEnd !== -1 && openingLineEnd < closingFence) {
      decorations.push({
        startPos: openingLineEnd,
        endPos: openingLineEnd + 1,
        type: 'hide',
      });
    }

    decorations.push({
      startPos: closingFence,
      endPos: closingEnd,
      type: 'hide',
    });
  }

  addScope(scopes, fenceStart, closingEnd, 'codeBlock');

  if (isMermaid) {
    const source = node.value ?? '';
    let numLines = 1;
    for (let i = 0; i < source.length; i++) {
      if (source.charCodeAt(i) === 10) {
        numLines++;
      }
    }
    mermaidBlocks.push({
      startPos: fenceStart,
      endPos: closingEnd,
      source,
      numLines,
    });
  }
}

function findOpeningFence(text: string, codeStart: number): FenceMatch | null {
  const codeLineStart = text.lastIndexOf('\n', codeStart - 1) + 1;

  const sameLineFence = findFenceInRange(text, codeLineStart, codeStart);
  if (sameLineFence) {
    return sameLineFence;
  }

  const forwardFence = findFenceInRange(text, codeStart, Math.min(codeStart + 20, text.length));
  if (forwardFence) {
    return forwardFence;
  }

  let lineStart = codeLineStart;
  for (let line = 0; line < MAX_FENCE_SEARCH_LINES && lineStart > 0; line++) {
    const prevLineEnd = lineStart - 1;
    lineStart = text.lastIndexOf('\n', prevLineEnd - 1) + 1;
    const prevLineFence = findFenceInRange(text, lineStart, prevLineEnd + 1);
    if (prevLineFence) {
      return prevLineFence;
    }
  }

  const fallbackFence = text.indexOf('```', Math.max(0, codeStart - 10));
  if (fallbackFence !== -1 && fallbackFence <= codeStart) {
    return {
      fenceStart: fallbackFence,
      fenceChar: '`',
      fenceLength: 3,
    };
  }

  return null;
}

function findClosingFence(
  text: string,
  codeEnd: number,
  fenceChar: string,
  fenceLength: number,
  fenceStart: number,
): number {
  const closingLineStart = text.lastIndexOf('\n', codeEnd - 1) + 1;
  const sameLineClosing = findClosingFenceInRange(
    text,
    closingLineStart,
    codeEnd,
    fenceChar,
    fenceLength,
    fenceStart,
    true,
  );
  if (sameLineClosing !== -1) {
    return sameLineClosing;
  }

  const forwardClosing = findClosingFenceInRange(
    text,
    codeEnd,
    Math.min(codeEnd + 20, text.length),
    fenceChar,
    fenceLength,
    fenceStart,
    false,
  );
  if (forwardClosing !== -1) {
    return forwardClosing;
  }

  let lineEnd = text.indexOf('\n', codeEnd);
  if (lineEnd === -1) {
    lineEnd = text.length;
  }

  for (let line = 0; line < MAX_FENCE_SEARCH_LINES && lineEnd < text.length; line++) {
    const nextLineStart = lineEnd + 1;
    if (nextLineStart >= text.length) {
      break;
    }
    const nextLineEnd = text.indexOf('\n', nextLineStart);
    const lineLimit = nextLineEnd === -1 ? text.length : nextLineEnd;
    const closing = findClosingFenceInRange(
      text,
      nextLineStart,
      lineLimit,
      fenceChar,
      fenceLength,
      fenceStart,
      false,
    );
    if (closing !== -1) {
      return closing;
    }
    if (nextLineEnd === -1) {
      break;
    }
    lineEnd = nextLineEnd;
  }

  return -1;
}

function findFenceInRange(text: string, start: number, end: number): FenceMatch | null {
  for (let pos = start; pos < end && pos < text.length; pos++) {
    const char = text[pos];
    if (char !== '`' && char !== '~') {
      continue;
    }
    let count = 1;
    let checkPos = pos + 1;
    while (checkPos < text.length && text[checkPos] === char && count < 20) {
      count++;
      checkPos++;
    }
    if (count >= 3) {
      return {
        fenceStart: pos,
        fenceChar: char,
        fenceLength: count,
      };
    }
  }
  return null;
}

function findClosingFenceInRange(
  text: string,
  start: number,
  end: number,
  fenceChar: string,
  fenceLength: number,
  fenceStart: number,
  searchBackward: boolean,
): number {
  if (searchBackward) {
    for (let pos = end - 1; pos >= start && pos >= fenceStart + fenceLength; pos--) {
      if (text[pos] !== fenceChar) {
        continue;
      }
      let count = 1;
      let checkPos = pos - 1;
      while (checkPos >= 0 && text[checkPos] === fenceChar && count < 20) {
        count++;
        checkPos--;
      }
      if (count >= fenceLength) {
        return pos - count + 1;
      }
    }
    return -1;
  }

  for (let pos = start; pos < end && pos < text.length; pos++) {
    if (text[pos] !== fenceChar) {
      continue;
    }
    let count = 1;
    let checkPos = pos + 1;
    while (checkPos < text.length && text[checkPos] === fenceChar && count < 20) {
      count++;
      checkPos++;
    }
    if (count >= fenceLength) {
      return pos;
    }
  }
  return -1;
}
