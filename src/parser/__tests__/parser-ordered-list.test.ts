import { MarkdownParser } from '../../parser';
import { config } from '../../config';

describe('MarkdownParser - Ordered List Auto-Numbering', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('basic auto-numbering with dot syntax', () => {
    it('should produce orderedListItem decorations with auto-numbered replacement', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      const result = parser.extractDecorations(markdown);

      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered).toHaveLength(3);
      expect(ordered[0].replacement).toBe('1. ');
      expect(ordered[1].replacement).toBe('2. ');
      expect(ordered[2].replacement).toBe('3. ');
    });

    it('should auto-number when all markers are 1.', () => {
      const markdown = '1. First\n1. Second\n1. Third';
      const result = parser.extractDecorations(markdown);

      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered).toHaveLength(3);
      expect(ordered[0].replacement).toBe('1. ');
      expect(ordered[1].replacement).toBe('2. ');
      expect(ordered[2].replacement).toBe('3. ');
    });

    it('should auto-number out-of-order markers based on position', () => {
      const markdown = '3. First\n1. Second\n2. Third';
      const result = parser.extractDecorations(markdown);

      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered).toHaveLength(3);
      // Remark normalizes: list starts at 3, items are sequential by position
      expect(ordered[0].replacement).toBe('3. ');
      expect(ordered[1].replacement).toBe('4. ');
      expect(ordered[2].replacement).toBe('5. ');
    });
  });

  describe('parenthesis syntax', () => {
    it('should produce auto-numbered replacement with ) delimiter', () => {
      const markdown = '1) First\n1) Second\n1) Third';
      const result = parser.extractDecorations(markdown);

      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered).toHaveLength(3);
      expect(ordered[0].replacement).toBe('1) ');
      expect(ordered[1].replacement).toBe('2) ');
      expect(ordered[2].replacement).toBe('3) ');
    });
  });

  describe('marker range', () => {
    it('should cover the full marker including trailing space', () => {
      const markdown = '1. Item';
      const result = parser.extractDecorations(markdown);

      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered).toHaveLength(1);
      // '1. ' is 3 characters (digit, dot, space)
      expect(ordered[0].startPos).toBe(0);
      expect(ordered[0].endPos).toBe(3);
    });

    it('should handle multi-digit numbers', () => {
      // Use all-same markers so remark treats them as one list
      const lines = Array.from({ length: 12 }, (_, i) => `1. Item ${i + 1}`);
      const markdown = lines.join('\n');
      const result = parser.extractDecorations(markdown);

      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered).toHaveLength(12);
      expect(ordered[9].replacement).toBe('10. ');
      expect(ordered[11].replacement).toBe('12. ');
    });
  });

  describe('nested ordered lists', () => {
    it('should auto-number inner list independently from outer list', () => {
      const markdown = '1. Outer 1\n   1. Inner 1\n   1. Inner 2\n1. Outer 2';
      const result = parser.extractDecorations(markdown);

      const ordered = result.filter(d => d.type === 'orderedListItem');
      // Expect 4 items: 2 outer + 2 inner, each numbered sequentially
      expect(ordered).toHaveLength(4);

      // Outer items should be numbered 1, 2
      const outerItems = ordered.filter(d => d.replacement?.startsWith('1.') || d.replacement?.startsWith('2.'));
      expect(outerItems.some(d => d.replacement === '1. ')).toBe(true);
      expect(outerItems.some(d => d.replacement === '2. ')).toBe(true);
    });
  });

  describe('single item list', () => {
    it('should produce replacement for a single-item ordered list', () => {
      const markdown = '1. Only item';
      const result = parser.extractDecorations(markdown);

      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered).toHaveLength(1);
      expect(ordered[0].replacement).toBe('1. ');
    });
  });

  describe('ordered list scope', () => {
    it('should create a listItem scope for ordered list items', () => {
      const markdown = '1. Item one\n2. Item two';
      const { scopes } = parser.extractDecorationsWithScopes(markdown);

      const listScopes = scopes.filter(s => s.kind === 'listItem');
      expect(listScopes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ordered list with checkboxes', () => {
    it('should produce orderedListItem decoration with replacement for checkbox items', () => {
      const markdown = '1. [ ] Task 1\n2. [x] Task 2';
      const result = parser.extractDecorations(markdown);

      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered).toHaveLength(2);
      expect(ordered[0].replacement).toBe('1. ');
      expect(ordered[1].replacement).toBe('2. ');

      // Checkboxes should also be present
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(true);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(true);
    });
  });

  describe('source vs computed number (mismatch hint)', () => {
    it('should set orderedListMarkerMismatch for lazy 1. lists when position advances', () => {
      const markdown = '1. First\n1. Second\n1. Third';
      const result = parser.extractDecorations(markdown);
      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered).toHaveLength(3);
      expect(ordered[0].orderedListMarkerMismatch).toBeFalsy();
      expect(ordered[1].orderedListMarkerMismatch).toBe(true);
      expect(ordered[2].orderedListMarkerMismatch).toBe(true);
    });

    it('should not set mismatch when source markers match the computed sequence', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      const result = parser.extractDecorations(markdown);
      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered.every(d => !d.orderedListMarkerMismatch)).toBe(true);
    });
  });

  describe('when orderedLists.autoNumber is false', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should not emit orderedListItem decorations', () => {
      vi.spyOn(config.orderedLists, 'autoNumber').mockReturnValue(false);
      const markdown = '1. First\n2. Second';
      const result = parser.extractDecorations(markdown);
      expect(result.filter(d => d.type === 'orderedListItem')).toHaveLength(0);
    });

    it('should still decorate checkboxes without hiding the ordered marker', () => {
      vi.spyOn(config.orderedLists, 'autoNumber').mockReturnValue(false);
      const markdown = '1. [ ] Task';
      const result = parser.extractDecorations(markdown);
      expect(result.filter(d => d.type === 'orderedListItem')).toHaveLength(0);
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(true);
    });
  });

  describe('when orderedLists.warnWhenSourceNumberDiffers is false', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should not set orderedListMarkerMismatch even for lazy lists', () => {
      vi.spyOn(config.orderedLists, 'warnWhenSourceNumberDiffers').mockReturnValue(false);
      const markdown = '1. First\n1. Second';
      const result = parser.extractDecorations(markdown);
      const ordered = result.filter(d => d.type === 'orderedListItem');
      expect(ordered.every(d => !d.orderedListMarkerMismatch)).toBe(true);
    });
  });
});
