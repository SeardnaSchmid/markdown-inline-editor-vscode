/** Minimal shape of `TextEditor.visibleRanges`, kept structural so it is trivially testable. */
export type VisibleLineRange = {
  start: { line: number };
  end: { line: number };
};

export type MermaidAnchor = {
  /** Line the diagram decoration attaches to. */
  anchorLine: number;
  /** Lines the anchor was pushed down from the block start, compensated with a negative margin. */
  lineOffset: number;
};

/**
 * Picks the line a Mermaid diagram should hang off for the current viewport.
 *
 * The rendered SVG lives in a `before` pseudo-element on a single line. VS Code
 * virtualises the editor and only builds DOM for visible lines, so anchoring at
 * the opening fence makes the whole diagram vanish as soon as the top of the
 * block scrolls past the viewport. Re-anchoring to the first still-visible line
 * of the block keeps the element alive; the caller offsets it back up by
 * `lineOffset` line heights so the diagram does not appear to jump.
 *
 * @param blockStartLine - First line of the Mermaid block
 * @param blockEndLine - Last line of the Mermaid block
 * @param visibleRanges - Editor viewport ranges (may be discontiguous when folded)
 * @returns The line to anchor on and how far it was pushed down
 */
export function computeMermaidAnchor(
  blockStartLine: number,
  blockEndLine: number,
  visibleRanges: readonly VisibleLineRange[]
): MermaidAnchor {
  const plainAnchor: MermaidAnchor = { anchorLine: blockStartLine, lineOffset: 0 };

  if (visibleRanges.length === 0) {
    return plainAnchor;
  }

  const firstVisibleLine = visibleRanges[0].start.line;
  const lastVisibleLine = visibleRanges[visibleRanges.length - 1].end.line;

  // Nothing to compensate for when the block cannot be seen at all; reusing the
  // plain anchor also avoids allocating a decoration type per offscreen offset.
  if (blockEndLine < firstVisibleLine || blockStartLine > lastVisibleLine) {
    return plainAnchor;
  }

  const anchorLine = Math.min(Math.max(firstVisibleLine, blockStartLine), blockEndLine);
  return { anchorLine, lineOffset: anchorLine - blockStartLine };
}
