import type { TextEditor } from 'vscode';
import type { MathRegion } from '../parser';
import type { MathDecorations } from '../math/math-decorations';
import { createRange, isSelectionOrCursorInsideOffsets } from './editor-decoration-applier';

export function applyMathDecorationsForEditor(
  editor: TextEditor,
  mathRegions: MathRegion[],
  normalizedText: string,
  mathDecorations: MathDecorations
): void {
  const regionsWithRanges = mathRegions.map((region) => {
    const inside = isSelectionOrCursorInsideOffsets(
      region.startPos,
      region.endPos,
      normalizedText,
      editor.selections,
      editor.document
    );
    return {
      region,
      range: inside ? null : createRange(editor, region.startPos, region.endPos, normalizedText),
    };
  });

  mathDecorations.apply(editor, regionsWithRanges);
}
