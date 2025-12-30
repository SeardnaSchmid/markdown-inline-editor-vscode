import { MarkdownParser } from '../../parser';

/**
 * Regression tests to prevent ordered lists from being rendered as unordered lists.
 * 
 * Bug: Ordered lists (1., 2., etc.) were incorrectly getting listItem decoration,
 * which caused them to be displayed with bullet points (•) instead of numbers.
 * 
 * Fix: Ordered lists without checkboxes should not receive listItem decoration.
 * They should be displayed as-is (markers visible) until auto-numbering is implemented.
 */
describe('MarkdownParser - Ordered Lists Regression Tests', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('ordered lists without checkboxes - should NOT have listItem decoration', () => {
    it('should not apply listItem decoration to simple ordered lists', () => {
      const markdown = '1. First item\n2. Second item\n3. Third item';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should not apply listItem decoration to ordered lists with dot markers', () => {
      const markdown = '1. Item one\n2. Item two\n3. Item three';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should not apply listItem decoration to ordered lists with parentheses markers', () => {
      const markdown = '1) Item one\n2) Item two\n3) Item three';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should not apply listItem decoration to multi-digit ordered list numbers', () => {
      const markdown = '123. Item one\n456. Item two\n789. Item three';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should not apply listItem decoration to mixed dot and parentheses markers', () => {
      const markdown = '1. Item one\n2) Item two\n3. Item three';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should not apply listItem decoration to ordered lists with formatting', () => {
      const markdown = '1. **Bold** item\n2. *Italic* item\n3. `Code` item';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
      
      // But should still have other decorations
      expect(result.some(d => d.type === 'bold')).toBe(true);
      expect(result.some(d => d.type === 'italic')).toBe(true);
      expect(result.some(d => d.type === 'code')).toBe(true);
    });

    it('should not apply listItem decoration to single ordered list item', () => {
      const markdown = '1. Single item';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });
  });

  describe('ordered lists with checkboxes - should HAVE listItem decoration', () => {
    it('should apply listItem decoration to ordered lists with unchecked checkboxes', () => {
      const markdown = '1. [ ] Task one\n2. [ ] Task two';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBeGreaterThan(0);
      
      const checkboxDecorations = result.filter(d => d.type === 'checkboxUnchecked');
      expect(checkboxDecorations.length).toBe(2);
    });

    it('should apply listItem decoration to ordered lists with checked checkboxes', () => {
      const markdown = '1. [x] Task one\n2. [X] Task two';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBeGreaterThan(0);
      
      const checkboxDecorations = result.filter(d => d.type === 'checkboxChecked');
      expect(checkboxDecorations.length).toBe(2);
    });

    it('should apply listItem decoration to ordered lists with mixed checkboxes', () => {
      const markdown = '1. [ ] Unchecked\n2. [x] Checked\n3. [ ] Unchecked';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBeGreaterThan(0);
    });

    it('should apply listItem decoration to ordered lists with parentheses markers and checkboxes', () => {
      const markdown = '1) [ ] Task one\n2) [x] Task two';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBeGreaterThan(0);
    });
  });

  describe('mixed scenarios - ordered vs unordered lists', () => {
    it('should handle mixed ordered and unordered lists correctly', () => {
      const markdown = '1. Ordered item\n- Unordered item\n2. Ordered item\n* Unordered item';
      const result = parser.extractDecorations(markdown);
      
      // Unordered lists should have listItem decoration
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      // Should have 2 listItem decorations (one for each unordered list)
      expect(listItemDecorations.length).toBe(2);
    });

    it('should not confuse ordered list numbers with unordered list markers', () => {
      const markdown = '1. Ordered item\n- Unordered item\n+ Unordered item';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      // Should have 2 listItem decorations (for the two unordered lists)
      expect(listItemDecorations.length).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle ordered lists with no space after marker', () => {
      const markdown = '1.Item without space\n2.Item without space';
      const result = parser.extractDecorations(markdown);
      
      // Even without space, should not get listItem decoration
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should handle ordered lists with multiple spaces after marker', () => {
      const markdown = '1.   Item with spaces\n2.   Item with spaces';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should handle invalid ordered list syntax gracefully', () => {
      const markdown = '1. [ ]task without space after checkbox';
      const result = parser.extractDecorations(markdown);
      
      // Invalid checkbox (no space) should not get listItem decoration
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
      
      // Should not have checkbox decoration either
      const checkboxDecorations = result.filter(d => 
        d.type === 'checkboxUnchecked' || d.type === 'checkboxChecked'
      );
      expect(checkboxDecorations.length).toBe(0);
    });
  });
});
