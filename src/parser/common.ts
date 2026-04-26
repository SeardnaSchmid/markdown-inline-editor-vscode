import type { Node } from 'mdast';
import type { DecorationRange, DecorationType, ScopeRange } from './types';

export function hasValidPosition(node: Node): boolean {
  return !!(
    node.position &&
    node.position.start.offset !== undefined &&
    node.position.end.offset !== undefined
  );
}

export function isInCodeBlock(ancestors: Node[]): boolean {
  return ancestors.some((ancestor) => ancestor.type === 'code' || ancestor.type === 'inlineCode');
}

export function addMarkerDecorations(
  decorations: DecorationRange[],
  start: number,
  end: number,
  markerLength: number,
  contentType: DecorationType,
): void {
  const contentStart = start + markerLength;
  const contentEnd = end - markerLength;

  decorations.push({ startPos: start, endPos: contentStart, type: 'hide' });

  if (contentStart < contentEnd) {
    decorations.push({
      startPos: contentStart,
      endPos: contentEnd,
      type: contentType,
    });
  }

  decorations.push({ startPos: contentEnd, endPos: end, type: 'hide' });
}

export function addScope(
  scopes: ScopeRange[],
  startPos: number,
  endPos: number,
  kind?: string,
): void {
  if (startPos < endPos) {
    scopes.push({ startPos, endPos, kind });
  }
}

export function dedupeScopes(scopes: ScopeRange[]): ScopeRange[] {
  if (scopes.length === 0) {
    return [];
  }

  const unique = new Map<string, ScopeRange>();
  for (const scope of scopes) {
    const key = `${scope.startPos}:${scope.endPos}`;
    if (!unique.has(key)) {
      unique.set(key, scope);
    }
  }

  return Array.from(unique.values()).sort((a, b) => {
    if (a.startPos !== b.startPos) {
      return a.startPos - b.startPos;
    }
    return a.endPos - b.endPos;
  });
}

export function getBoldMarker(text: string, pos: number): string | null {
  if (pos + 2 <= text.length) {
    const char1 = text.charCodeAt(pos);
    const char2 = text.charCodeAt(pos + 1);

    if (char1 === 0x2a && char2 === 0x2a) {
      return '**';
    }

    if (char1 === 0x5f && char2 === 0x5f) {
      return '__';
    }
  }

  return null;
}

export function getItalicMarker(text: string, pos: number): string | null {
  if (pos + 1 <= text.length) {
    const charCode = text.charCodeAt(pos);

    if (charCode === 0x2a) {
      return '*';
    }

    if (charCode === 0x5f) {
      return '_';
    }
  }

  return null;
}
