import type { DecorationRange, ScopeRange } from './types';
import { addScope } from './common';

export const MIN_FRONTMATTER_LENGTH = 3;
export const MAX_FRONTMATTER_SEARCH_LINES = 100;

export function processFrontmatter(
  text: string,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
): void {
  if (!text || text.length < MIN_FRONTMATTER_LENGTH) {
    return;
  }

  let startPos = 0;
  while (
    startPos < text.length &&
    (text[startPos] === ' ' || text[startPos] === '\t')
  ) {
    startPos++;
  }

  if (
    startPos + MIN_FRONTMATTER_LENGTH > text.length ||
    text.substring(startPos, startPos + MIN_FRONTMATTER_LENGTH) !== '---'
  ) {
    return;
  }

  const openingDelimiterStart = startPos;
  const openingLineEnd = text.indexOf('\n', openingDelimiterStart);
  if (openingLineEnd === -1) {
    return;
  }
  const openingLineEndPos = openingLineEnd + 1;

  let searchPos = openingLineEndPos;
  let linesSearched = 0;
  while (searchPos < text.length && linesSearched < MAX_FRONTMATTER_SEARCH_LINES) {
    const lineStart = searchPos;
    let lineStartPos = lineStart;

    while (lineStartPos < text.length && /\s/.test(text[lineStartPos])) {
      lineStartPos++;
    }

    if (
      lineStartPos + MIN_FRONTMATTER_LENGTH <= text.length &&
      text.substring(lineStartPos, lineStartPos + MIN_FRONTMATTER_LENGTH) === '---'
    ) {
      const closingDelimiterStart = lineStartPos;
      const closingLineEnd = text.indexOf('\n', closingDelimiterStart);
      const lineEnd = closingLineEnd === -1 ? text.length : closingLineEnd;
      const lineContent = text.substring(lineStartPos, lineEnd);

      if (!/^---\s*$/.test(lineContent)) {
        const nextLine = closingLineEnd === -1 ? text.length : closingLineEnd + 1;
        searchPos = nextLine;
        linesSearched++;
        continue;
      }

      const lineBeforeDelimiter = text.substring(lineStart, lineStartPos);
      const isOnlyWhitespaceBefore = /^\s*$/.test(lineBeforeDelimiter);

      if (isOnlyWhitespaceBefore) {
        const closingLineEndPos =
          closingLineEnd === -1
            ? closingDelimiterStart + MIN_FRONTMATTER_LENGTH
            : closingLineEnd;

        decorations.push({
          startPos: openingDelimiterStart,
          endPos: closingLineEndPos,
          type: 'frontmatter',
        });

        addScope(scopes, openingDelimiterStart, closingLineEndPos, 'frontmatter');

        const openingDelimiterEnd = openingDelimiterStart + MIN_FRONTMATTER_LENGTH;
        decorations.push({
          startPos: openingDelimiterStart,
          endPos: openingDelimiterEnd,
          type: 'frontmatterDelimiter',
        });

        const closingDelimiterEnd = closingDelimiterStart + MIN_FRONTMATTER_LENGTH;
        decorations.push({
          startPos: closingDelimiterStart,
          endPos: closingDelimiterEnd,
          type: 'frontmatterDelimiter',
        });
      }
      return;
    }

    const nextLine = text.indexOf('\n', searchPos);
    if (nextLine === -1) {
      break;
    }
    searchPos = nextLine + 1;
    linesSearched++;
  }
}
