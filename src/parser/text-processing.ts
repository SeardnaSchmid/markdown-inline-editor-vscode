import type { Node, Text } from 'mdast';
import { addScope, hasValidPosition, isInCodeBlock } from './common';
import type { DecorationRange, ScopeRange } from './types';

export function processTextNode(
  node: Text,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
  ancestors: Node[],
  processEmojiShortcodesInSlice: (
    slice: string,
    offset: number,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
  ) => void,
): void {
  if (!hasValidPosition(node) || isInCodeBlock(ancestors)) {
    return;
  }

  const start = node.position!.start.offset!;
  processEmojiShortcodesInSlice(node.value, start, decorations, scopes);
}

export function processEmojiShortcodesInSlice(
  slice: string,
  offset: number,
  decorations: DecorationRange[],
  scopes: ScopeRange[],
  emojiByShortcode: Record<string, string>,
): void {
  if (!slice || slice.indexOf(':') === -1) {
    return;
  }

  const regex = /:([a-z0-9_+-]+):/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(slice)) !== null) {
    const name = match[1].toLowerCase();
    const emoji = emojiByShortcode[name];
    if (!emoji) {
      continue;
    }

    const start = offset + match.index;
    const end = start + match[0].length;
    decorations.push({
      startPos: start,
      endPos: end,
      type: 'emoji',
      emoji,
    });
    addScope(scopes, start, end, 'emoji');
  }
}

export function handleEmptyImageAlt(
  text: string,
  decorations: DecorationRange[],
): void {
  if (text.indexOf('![') === -1) {
    return;
  }

  const regex = /!\[\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const pos = match.index;
    const isCovered = decorations.some(
      (decoration) => decoration.startPos <= pos && decoration.endPos > pos,
    );
    if (!isCovered) {
      decorations.push({ startPos: pos, endPos: pos + 2, type: 'hide' });
      decorations.push({ startPos: pos + 2, endPos: pos + 3, type: 'hide' });
    }
  }
}
