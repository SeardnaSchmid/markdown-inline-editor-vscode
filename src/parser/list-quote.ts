import type { Blockquote, ListItem, Node, ThematicBreak } from 'mdast';
import { addScope, hasValidPosition, isInCodeBlock } from './common';
import type { DecorationRange, ScopeRange } from './types';

export function processBlockquote(
  node: Blockquote,
  text: string,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
  processedPositions: Set<number>,
  ancestors: Node[],
): void {
  if (!hasValidPosition(node) || isInCodeBlock(ancestors)) {
    return;
  }

  const start = node.position!.start.offset!;
  const end = node.position!.end.offset!;
  let pos = start;
  while (pos < end) {
    const lineStart = pos === 0 ? 0 : text.lastIndexOf('\n', pos - 1) + 1;
    let searchStart = lineStart;
    const lineEnd = text.indexOf('\n', lineStart);
    const actualLineEnd = lineEnd === -1 ? end : Math.min(lineEnd, end);

    while (searchStart < actualLineEnd) {
      const gtIndex = text.indexOf('>', searchStart);
      if (gtIndex === -1 || gtIndex >= actualLineEnd) break;
      if (processedPositions.has(gtIndex)) {
        searchStart = gtIndex + 1;
        continue;
      }

      const beforeGt = text.substring(lineStart, gtIndex);
      const isBlockquoteMarker =
        beforeGt.trim().length === 0 || /^[\s>]*$/.test(beforeGt);

      if (isBlockquoteMarker) {
        processedPositions.add(gtIndex);
        decorations.push({
          startPos: gtIndex,
          endPos: gtIndex + 1,
          type: 'blockquote',
        });
      }
      searchStart = gtIndex + 1;
    }

    const nextLine = text.indexOf('\n', pos);
    if (nextLine === -1 || nextLine >= end) break;
    pos = nextLine + 1;
  }

  addScope(scopes, start, end, 'blockquote');
}

export function processListItem(
  node: ListItem,
  text: string,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
  ancestors: Node[],
): void {
  if (!hasValidPosition(node) || isInCodeBlock(ancestors)) {
    return;
  }

  const start = node.position!.start.offset!;
  const end = node.position!.end.offset!;
  let markerEnd = start;
  while (markerEnd < end && /\s/.test(text[markerEnd])) {
    markerEnd++;
  }
  if (markerEnd >= end) {
    return;
  }

  addScope(scopes, start, end, 'listItem');
  const markerStart = markerEnd;

  if (text[markerEnd] === '-' || text[markerEnd] === '*' || text[markerEnd] === '+') {
    markerEnd++;
    if (markerEnd < end && text[markerEnd] === ' ') {
      markerEnd++;
    }
    if (tryAddCheckboxDecorations(text, markerStart, markerEnd, end, decorations, false)) {
      return;
    }
    decorations.push({ startPos: markerStart, endPos: markerEnd, type: 'listItem' });
    return;
  }

  if (/\d/.test(text[markerEnd])) {
    let numEnd = markerEnd;
    while (numEnd < end && /\d/.test(text[numEnd])) {
      numEnd++;
    }
    if (numEnd < end && (text[numEnd] === '.' || text[numEnd] === ')')) {
      markerEnd = numEnd + 1;
      if (markerEnd < end && text[markerEnd] === ' ') {
        markerEnd++;
      }
      if (tryAddCheckboxDecorations(text, markerStart, markerEnd, end, decorations, true)) {
        return;
      }
      decorations.push({ startPos: markerStart, endPos: markerEnd, type: 'orderedListItem' });
    }
  }
}

export function processThematicBreak(
  node: ThematicBreak,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
  ancestors: Node[],
): void {
  if (!hasValidPosition(node) || isInCodeBlock(ancestors)) {
    return;
  }

  const start = node.position!.start.offset!;
  const end = node.position!.end.offset!;
  const isInFrontmatter = decorations.some(
    (decoration) => decoration.type === 'frontmatter' && decoration.startPos <= start && decoration.endPos >= end,
  );
  if (isInFrontmatter) {
    return;
  }

  decorations.push({
    startPos: start,
    endPos: end,
    type: 'horizontalRule',
  });
  addScope(scopes, start, end, 'horizontalRule');
}

function tryAddCheckboxDecorations(
  text: string,
  markerStart: number,
  markerEnd: number,
  end: number,
  decorations: DecorationRange[],
  isOrderedList: boolean,
): boolean {
  if (markerEnd + 3 >= end || text[markerEnd] !== '[') {
    return false;
  }

  const checkChar = text[markerEnd + 1];
  if (
    (checkChar !== ' ' && checkChar !== 'x' && checkChar !== 'X') ||
    text[markerEnd + 2] !== ']'
  ) {
    return false;
  }

  if (text[markerEnd + 3] !== ' ') {
    return false;
  }

  const checkboxStart = markerEnd;
  const checkboxEnd = checkboxStart + 3;
  const isChecked = checkChar === 'x' || checkChar === 'X';

  if (isOrderedList) {
    decorations.push({
      startPos: markerStart,
      endPos: markerEnd,
      type: 'orderedListItem',
    });
  }

  decorations.push({
    startPos: isOrderedList ? checkboxStart : markerStart,
    endPos: checkboxEnd,
    type: isChecked ? 'checkboxChecked' : 'checkboxUnchecked',
  });
  return true;
}
