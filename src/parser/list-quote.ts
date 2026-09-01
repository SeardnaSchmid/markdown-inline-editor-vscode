import type { Blockquote, List, ListItem, Node, ThematicBreak } from 'mdast';
import { config } from '../config';
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
    if (tryAddCheckboxDecorations(text, markerStart, markerEnd, end, decorations, scopes, false)) {
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
      const delimiter = text[numEnd];
      markerEnd = numEnd + 1;
      if (markerEnd < end && text[markerEnd] === ' ') {
        markerEnd++;
      }

      const parentList = ancestors[0] as List | undefined;
      const itemIndex = parentList?.children ? parentList.children.indexOf(node) : -1;
      const autoNumber =
        itemIndex >= 0
          ? (parentList!.start ?? 1) + itemIndex
          : parseInt(text.slice(markerStart, numEnd), 10);
      const writtenNumber = parseInt(text.slice(markerStart, numEnd), 10);
      const replacement = `${autoNumber}${delimiter} `;
      const autoNumberEnabled = config.orderedLists.autoNumber();
      const sourceMismatch =
        autoNumberEnabled &&
        config.orderedLists.warnWhenSourceNumberDiffers() &&
        writtenNumber !== autoNumber;

      if (!autoNumberEnabled) {
        tryAddCheckboxDecorations(text, markerStart, markerEnd, end, decorations, scopes, true);
        return;
      }

      if (
        tryAddCheckboxDecorations(
          text,
          markerStart,
          markerEnd,
          end,
          decorations,
          scopes,
          true,
          replacement,
          sourceMismatch,
        )
      ) {
        return;
      }

      decorations.push({
        startPos: markerStart,
        endPos: markerEnd,
        type: 'orderedListItem',
        replacement,
        orderedListMarkerMismatch: sourceMismatch,
      });
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
  scopes: ScopeRange[],
  isOrderedList: boolean,
  orderedReplacement?: string,
  orderedListMarkerMismatch?: boolean,
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

  if (isOrderedList && orderedReplacement !== undefined) {
    decorations.push({
      startPos: markerStart,
      endPos: markerEnd,
      type: 'orderedListItem',
      replacement: orderedReplacement,
      orderedListMarkerMismatch,
    });
  }

  // The box has to sit on a single real character. VS Code's mouse hit testing
  // skips a run of characters whose decoration collapses it, so a box drawn as
  // a pseudo-element over "- [ ]" is not clickable at all; one drawn on the
  // state character itself is. Everything around it is hidden separately.
  const boxStart = checkboxStart + 1;
  const prefixStart = isOrderedList ? checkboxStart : markerStart;

  decorations.push({ startPos: prefixStart, endPos: boxStart, type: 'checkboxBracket' });
  decorations.push({
    startPos: boxStart,
    endPos: boxStart + 1,
    type: isChecked ? 'checkboxChecked' : 'checkboxUnchecked',
  });
  decorations.push({ startPos: boxStart + 1, endPos: checkboxEnd, type: 'checkboxBracket' });

  // One scope over the whole checkbox so moving the cursor onto any part of it
  // reveals the raw `- [ ]` as a unit rather than half-rendered.
  addScope(scopes, prefixStart, checkboxEnd, 'checkbox');
  return true;
}
