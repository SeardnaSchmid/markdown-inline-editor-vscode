import type { DecorationRange, DecorationType, ScopeRange } from './types';
import { addScope } from './common';

function looksLikeEmailAt(text: string, atIdx: number): boolean {
  let lo = atIdx - 1;
  while (lo >= 0 && /[a-zA-Z0-9._%+-]/.test(text[lo])) lo--;
  const localPart = text.slice(lo + 1, atIdx);
  let hi = atIdx + 1;
  while (hi < text.length && /[a-zA-Z0-9.-]/.test(text[hi])) hi++;
  const domainPart = text.slice(atIdx + 1, hi);
  if (!localPart.length || !domainPart.length) return false;
  if (!/\./.test(domainPart)) return false;
  return true;
}

function getCodeBlockRanges(scopes: ScopeRange[]): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const scope of scopes) {
    if (scope.kind === 'codeBlock' || scope.kind === 'code') {
      out.push({ start: scope.startPos, end: scope.endPos });
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

export function scanMentionAndIssueRefs(
  text: string,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
): void {
  const codeRanges = getCodeBlockRanges(scopes);
  const inCode = (start: number, end: number) =>
    codeRanges.some((range) => start < range.end && end > range.start);
  const occupiedIssueRanges: Array<{ start: number; end: number }> = [];
  const overlapsIssueRange = (start: number, end: number) =>
    occupiedIssueRanges.some((range) => start < range.end && end > range.start);

  const repoScopedRefRe =
    /@([a-zA-Z0-9][a-zA-Z0-9-]*)\/([a-zA-Z0-9][a-zA-Z0-9-]*)#(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = repoScopedRefRe.exec(text)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (inCode(start, end) || looksLikeEmailAt(text, start)) continue;
    const ownerRepo = `${match[1]}/${match[2]}`;
    decorations.push({
      startPos: start,
      endPos: end,
      type: 'issueReference',
      issueNumber: parseInt(match[3], 10),
      ownerRepo,
    });
    occupiedIssueRanges.push({ start, end });
    addScope(scopes, start, end, 'issueReference');
  }

  const orgTeamRe =
    /@([a-zA-Z0-9][a-zA-Z0-9-]*)\/([a-zA-Z0-9][a-zA-Z0-9-]*)(?=$|[^a-zA-Z0-9-])/g;
  while ((match = orgTeamRe.exec(text)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (inCode(start, end) || looksLikeEmailAt(text, start) || text[end] === '#') continue;
    decorations.push({
      startPos: start,
      endPos: end,
      type: 'mention',
      slug: `${match[1]}/${match[2]}`,
    });
    addScope(scopes, start, end, 'mention');
  }

  const userRe = /@([a-zA-Z0-9][a-zA-Z0-9-]*)(?![a-zA-Z0-9_/-])/g;
  while ((match = userRe.exec(text)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (inCode(start, end) || looksLikeEmailAt(text, start)) continue;
    decorations.push({
      startPos: start,
      endPos: end,
      type: 'mention',
      slug: match[1],
    });
    addScope(scopes, start, end, 'mention');
  }

  const issueRe = /#(\d+)/g;
  while ((match = issueRe.exec(text)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (inCode(start, end) || overlapsIssueRange(start, end)) continue;
    decorations.push({
      startPos: start,
      endPos: end,
      type: 'issueReference',
      issueNumber: parseInt(match[1], 10),
    });
    addScope(scopes, start, end, 'issueReference');
  }
}

export function filterDecorationsInCodeBlocks(
  decorations: DecorationRange[],
  scopes: ScopeRange[],
  text: string,
): void {
  const codeBlockRanges: Array<{
    start: number;
    end: number;
    isFenced: boolean;
    openingLineEnd?: number;
  }> = [];

  for (const scope of scopes) {
    if (scope.kind === 'codeBlock') {
      const openingLineEnd = text.indexOf('\n', scope.startPos);
      codeBlockRanges.push({
        start: scope.startPos,
        end: scope.endPos,
        isFenced: true,
        openingLineEnd: openingLineEnd !== -1 ? openingLineEnd + 1 : undefined,
      });
    } else if (scope.kind === 'code') {
      codeBlockRanges.push({
        start: scope.startPos,
        end: scope.endPos,
        isFenced: false,
      });
    }
  }

  if (codeBlockRanges.length === 0) {
    return;
  }

  codeBlockRanges.sort((a, b) => a.start - b.start);
  const minCodeBlockStart = codeBlockRanges[0].start;
  const maxCodeBlockEnd = Math.max(...codeBlockRanges.map((range) => range.end));
  const alwaysAllowed = new Set<DecorationType>([
    'codeBlock',
    'codeBlockLanguage',
    'code',
    'transparent',
  ]);

  for (let i = decorations.length - 1; i >= 0; i--) {
    const decoration = decorations[i];

    if (alwaysAllowed.has(decoration.type)) {
      continue;
    }

    if (
      decoration.endPos <= minCodeBlockStart ||
      decoration.startPos >= maxCodeBlockEnd
    ) {
      continue;
    }

    let matchingRange: (typeof codeBlockRanges)[0] | undefined;
    for (const range of codeBlockRanges) {
      if (decoration.startPos < range.start) {
        break;
      }
      if (
        decoration.startPos >= range.start &&
        decoration.endPos <= range.end
      ) {
        matchingRange = range;
        break;
      }
    }

    if (!matchingRange) {
      continue;
    }

    if (decoration.type === 'hide' && matchingRange.isFenced) {
      const isOpeningFence = decoration.startPos === matchingRange.start;
      const isClosingFence = decoration.endPos === matchingRange.end;
      const isOnOpeningLine =
        matchingRange.openingLineEnd !== undefined &&
        decoration.startPos >= matchingRange.start &&
        decoration.endPos <= matchingRange.openingLineEnd;

      if (isOpeningFence || isClosingFence || isOnOpeningLine) {
        continue;
      }
      decorations.splice(i, 1);
      continue;
    }

    if (decoration.type === 'hide' && !matchingRange.isFenced) {
      decorations.splice(i, 1);
      continue;
    }

    decorations.splice(i, 1);
  }
}
