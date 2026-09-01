import { computeMermaidAnchor } from '../mermaid-anchor';

/** Build the visible-range shape the anchor helper consumes. */
function visible(startLine: number, endLine: number) {
  return [{ start: { line: startLine }, end: { line: endLine } }];
}

describe('computeMermaidAnchor', () => {
  // A diagram spanning lines 10-30 in a viewport showing lines 5-40.
  describe('block fully inside the viewport', () => {
    it('anchors at the block start with no offset', () => {
      expect(computeMermaidAnchor(10, 30, visible(5, 40))).toEqual({
        anchorLine: 10,
        lineOffset: 0,
      });
    });

    it('anchors at the block start when the block starts exactly at the top', () => {
      expect(computeMermaidAnchor(10, 30, visible(10, 40))).toEqual({
        anchorLine: 10,
        lineOffset: 0,
      });
    });
  });

  // The bug: once the opening fence scrolls above the viewport, VS Code recycles
  // that line's DOM and the `before` pseudo-element carrying the SVG disappears.
  describe('block top scrolled above the viewport', () => {
    it('re-anchors to the first visible line and reports the offset', () => {
      expect(computeMermaidAnchor(10, 30, visible(13, 40))).toEqual({
        anchorLine: 13,
        lineOffset: 3,
      });
    });

    it('re-anchors when only the last line of the block is still visible', () => {
      expect(computeMermaidAnchor(10, 30, visible(30, 50))).toEqual({
        anchorLine: 30,
        lineOffset: 20,
      });
    });
  });

  describe('block outside the viewport', () => {
    it('keeps the plain anchor when the block is entirely below the viewport', () => {
      expect(computeMermaidAnchor(10, 30, visible(0, 5))).toEqual({
        anchorLine: 10,
        lineOffset: 0,
      });
    });

    it('keeps the plain anchor when the block is entirely above the viewport', () => {
      // Reusing offset 0 here avoids creating a decoration type nobody can see.
      expect(computeMermaidAnchor(10, 30, visible(50, 80))).toEqual({
        anchorLine: 10,
        lineOffset: 0,
      });
    });
  });

  describe('degenerate input', () => {
    it('keeps the plain anchor when no visible ranges are reported', () => {
      expect(computeMermaidAnchor(10, 30, [])).toEqual({
        anchorLine: 10,
        lineOffset: 0,
      });
    });

    it('uses the first range start across folded, discontiguous ranges', () => {
      const folded = [
        { start: { line: 12 }, end: { line: 14 } },
        { start: { line: 20 }, end: { line: 40 } },
      ];
      expect(computeMermaidAnchor(10, 30, folded)).toEqual({
        anchorLine: 12,
        lineOffset: 2,
      });
    });

    it('handles a single-line block', () => {
      expect(computeMermaidAnchor(10, 10, visible(10, 40))).toEqual({
        anchorLine: 10,
        lineOffset: 0,
      });
    });
  });
});
