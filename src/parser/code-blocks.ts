import type { Code } from 'mdast';
import { addScope, hasValidPosition } from './common';
import type { DecorationRange, MermaidBlock, ScopeRange } from './types';

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
  let fenceStart = codeStart;
  let fenceChar: string | null = null;
  let fenceLength = 0;
  const lineStart = text.lastIndexOf('\n', codeStart - 1) + 1;

  for (let pos = lineStart; pos < codeStart && pos < text.length; pos++) {
    const char = text[pos];
    if (char === '`' || char === '~') {
      let count = 1;
      let checkPos = pos + 1;
      while (checkPos < text.length && text[checkPos] === char && count < 20) {
        count++;
        checkPos++;
      }
      if (count >= 3) {
        fenceStart = pos;
        fenceChar = char;
        fenceLength = count;
        break;
      }
    }
  }

  if (!fenceChar) {
    for (let pos = codeStart; pos < Math.min(codeStart + 20, text.length); pos++) {
      const char = text[pos];
      if (char === '`' || char === '~') {
        let count = 1;
        let checkPos = pos + 1;
        while (checkPos < text.length && text[checkPos] === char && count < 20) {
          count++;
          checkPos++;
        }
        if (count >= 3) {
          fenceStart = pos;
          fenceChar = char;
          fenceLength = count;
          break;
        }
      }
    }
  }

  if (!fenceChar || fenceLength < 3) {
    const fallbackFence = text.indexOf('```', codeStart - 10);
    if (fallbackFence === -1 || fallbackFence > codeStart) {
      return;
    }
    fenceStart = fallbackFence;
    fenceChar = '`';
    fenceLength = 3;
  }

  let closingFence = -1;
  const closingLineStart = text.lastIndexOf('\n', codeEnd - 1) + 1;
  for (let pos = codeEnd - 1; pos >= closingLineStart && pos >= fenceStart + fenceLength; pos--) {
    if (text[pos] === fenceChar) {
      let count = 1;
      let checkPos = pos - 1;
      while (checkPos >= 0 && text[checkPos] === fenceChar && count < 20) {
        count++;
        checkPos--;
      }
      if (count >= fenceLength) {
        closingFence = pos - count + 1;
        break;
      }
    }
  }

  if (closingFence === -1) {
    for (let pos = codeEnd; pos < Math.min(codeEnd + 20, text.length); pos++) {
      if (text[pos] === fenceChar) {
        let count = 1;
        let checkPos = pos + 1;
        while (checkPos < text.length && text[checkPos] === fenceChar && count < 20) {
          count++;
          checkPos++;
        }
        if (count >= fenceLength) {
          closingFence = pos;
          break;
        }
      }
    }
  }

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
