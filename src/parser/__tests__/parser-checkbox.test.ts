import { MarkdownParser } from '../../parser';

describe('MarkdownParser - Checkbox/Task List', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('unchecked checkbox (- [ ])', () => {
    it('should detect unchecked checkbox with dash marker', () => {
      const markdown = '- [ ] Task item';
      const result = parser.extractDecorations(markdown);

      // No listItem when checkbox is present; single checkbox covers marker + "[ ]"
      expect(result.filter(d => d.type === 'listItem').length).toBe(0);
      expect(result).toContainEqual({
        startPos: 0,
        endPos: 5,
        type: 'checkboxUnchecked'
      });
    });

    it('should detect unchecked checkbox with asterisk marker', () => {
      const markdown = '* [ ] Task item';
      const result = parser.extractDecorations(markdown);

      expect(result.filter(d => d.type === 'listItem').length).toBe(0);
      expect(result).toContainEqual({
        startPos: 0,
        endPos: 5,
        type: 'checkboxUnchecked'
      });
    });

    it('should detect unchecked checkbox with plus marker', () => {
      const markdown = '+ [ ] Task item';
      const result = parser.extractDecorations(markdown);

      expect(result.filter(d => d.type === 'listItem').length).toBe(0);
      expect(result).toContainEqual({
        startPos: 0,
        endPos: 5,
        type: 'checkboxUnchecked'
      });
    });
  });

  describe('checked checkbox (- [x])', () => {
    it('should detect checked checkbox with lowercase x', () => {
      const markdown = '- [x] Completed task';
      const result = parser.extractDecorations(markdown);

      expect(result.filter(d => d.type === 'listItem').length).toBe(0);
      expect(result).toContainEqual({
        startPos: 0,
        endPos: 5,
        type: 'checkboxChecked'
      });
    });

    it('should detect checked checkbox with uppercase X', () => {
      const markdown = '- [X] Completed task';
      const result = parser.extractDecorations(markdown);

      expect(result.filter(d => d.type === 'listItem').length).toBe(0);
      expect(result).toContainEqual({
        startPos: 0,
        endPos: 5,
        type: 'checkboxChecked'
      });
    });
  });

  describe('multiple checkboxes', () => {
    it('should handle multiple checkboxes on different lines', () => {
      const markdown = '- [ ] Task 1\n- [x] Task 2\n- [ ] Task 3';
      const result = parser.extractDecorations(markdown);

      const uncheckedDecorations = result.filter(d => d.type === 'checkboxUnchecked');
      const checkedDecorations = result.filter(d => d.type === 'checkboxChecked');

      expect(uncheckedDecorations.length).toBe(2);
      expect(checkedDecorations.length).toBe(1);
    });
  });

  describe('indented checkboxes', () => {
    it('should detect checkbox in indented list item', () => {
      const markdown = '  - [ ] Indented task';
      const result = parser.extractDecorations(markdown);

      expect(result.filter(d => d.type === 'listItem').length).toBe(0);
      expect(result).toContainEqual({
        startPos: 2,
        endPos: 7,
        type: 'checkboxUnchecked'
      });
    });
  });

  describe('regular list items without checkbox', () => {
    it('should not create checkbox decoration for regular list item', () => {
      const markdown = '- Regular item';
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'listItem')).toBe(true);
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
    });

    it('should not match brackets that are not checkboxes', () => {
      const markdown = '- [link] text';
      const result = parser.extractDecorations(markdown);

      // This should be treated as a regular list item, not a checkbox
      expect(result.some(d => d.type === 'listItem')).toBe(true);
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
    });

    it('should create orderedListItem decoration for ordered list without checkbox', () => {
      const markdown = '1. Regular ordered item';
      const result = parser.extractDecorations(markdown);

      // Ordered lists get orderedListItem decoration with auto-numbered replacement
      expect(result.some(d => d.type === 'listItem')).toBe(false);
      expect(result.some(d => d.type === 'orderedListItem')).toBe(true);
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
    });

    it('should create orderedListItem decoration for ordered list with parentheses marker', () => {
      const markdown = '1) Regular ordered item';
      const result = parser.extractDecorations(markdown);

      // Ordered lists get orderedListItem decoration with auto-numbered replacement
      expect(result.some(d => d.type === 'listItem')).toBe(false);
      expect(result.some(d => d.type === 'orderedListItem')).toBe(true);
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
    });
  });

  describe('checkbox without trailing space', () => {
    it('should NOT detect checkbox without space after ] (GFM spec requirement)', () => {
      // GFM spec requires a space after the closing bracket for task lists
      // "- [ ]Task" is NOT a valid task list - it's a regular list item
      const markdown = '- [ ]Task';
      const result = parser.extractDecorations(markdown);

      // Should NOT detect as checkbox (GFM requires space after ])
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
      // Should still be a regular list item
      expect(result.some(d => d.type === 'listItem')).toBe(true);
    });
  });

  describe('ordered list checkboxes', () => {
    it('should detect unchecked checkbox in ordered list with dot marker', () => {
      const markdown = '1. [ ] Task item';
      const result = parser.extractDecorations(markdown);

      // Ordered lists should NOT have listItem decoration (they keep their numbers)
      expect(result.some(d => d.type === 'listItem')).toBe(false);
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(true);
    });

    it('should detect checked checkbox in ordered list with dot marker', () => {
      const markdown = '1. [x] Completed task';
      const result = parser.extractDecorations(markdown);

      // Ordered lists should NOT have listItem decoration (they keep their numbers)
      expect(result.some(d => d.type === 'listItem')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(true);
    });

    it('should detect checkbox in ordered list with parentheses marker', () => {
      const markdown = '1) [ ] Task item';
      const result = parser.extractDecorations(markdown);

      // Ordered lists should NOT have listItem decoration (they keep their numbers)
      expect(result.some(d => d.type === 'listItem')).toBe(false);
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(true);
    });

    it('should handle multi-digit ordered list numbers', () => {
      const markdown = '123. [ ] Task item';
      const result = parser.extractDecorations(markdown);

      // Ordered lists should NOT have listItem decoration (they keep their numbers)
      expect(result.some(d => d.type === 'listItem')).toBe(false);
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(true);
    });

    it('should handle multiple ordered list checkboxes', () => {
      const markdown = '1. [ ] Task 1\n2. [x] Task 2\n3. [ ] Task 3';
      const result = parser.extractDecorations(markdown);

      // Ordered lists should NOT have listItem decoration (they keep their numbers)
      expect(result.some(d => d.type === 'listItem')).toBe(false);
      
      const uncheckedDecorations = result.filter(d => d.type === 'checkboxUnchecked');
      const checkedDecorations = result.filter(d => d.type === 'checkboxChecked');

      expect(uncheckedDecorations.length).toBe(2);
      expect(checkedDecorations.length).toBe(1);
    });
  });

  describe('edge cases - missing spaces', () => {
    // GFM spec requires a space after the closing bracket for task lists.
    // Without a space, it's not a valid task list (e.g., "- [x]task" is not a task list).
    
    it('should NOT detect checkbox without space after closing bracket (GFM spec)', () => {
      // According to GFM, "- [ ]task" is NOT a task list - it's a regular list item
      const markdown = '- [ ]Task without space after checkbox';
      const result = parser.extractDecorations(markdown);

      // Should NOT detect as checkbox (GFM requires space after ])
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
      // Should still be a regular list item
      expect(result.some(d => d.type === 'listItem')).toBe(true);
    });

    it('should NOT detect ordered list checkbox without space after bracket (GFM spec)', () => {
      // According to GFM, "1. [ ]task" is NOT a task list
      const markdown = '1. [ ]Task without space after checkbox';
      const result = parser.extractDecorations(markdown);

      // Should NOT detect as checkbox (GFM requires space after ])
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
      // Ordered lists should NOT have listItem decoration (they keep their numbers)
      expect(result.some(d => d.type === 'listItem')).toBe(false);
    });

    it('should NOT detect checked checkbox without space after bracket (GFM spec)', () => {
      // According to GFM, "- [x]task" is NOT a task list
      const markdown = '- [x]No space after checkbox';
      const result = parser.extractDecorations(markdown);

      // Should NOT detect as checkbox (GFM requires space after ])
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
      // Should still be a regular list item
      expect(result.some(d => d.type === 'listItem')).toBe(true);
    });
  });

  describe('invalid syntax handling', () => {
    it('should not match invalid checkbox patterns', () => {
      const markdown = '- [a] Not a checkbox';
      const result = parser.extractDecorations(markdown);

      // Should not create checkbox decoration
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
      // But should still have listItem decoration
      expect(result.some(d => d.type === 'listItem')).toBe(true);
    });

    it('should not match incomplete checkbox patterns', () => {
      const markdown = '- [ Not a checkbox';
      const result = parser.extractDecorations(markdown);

      // Should not create checkbox decoration
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
      expect(result.some(d => d.type === 'checkboxChecked')).toBe(false);
    });

    it('should not match checkbox-like patterns in regular text', () => {
      const markdown = 'This is not a list: [ ] item';
      const result = parser.extractDecorations(markdown);

      // Should not create checkbox decoration (not in a list context)
      expect(result.some(d => d.type === 'checkboxUnchecked')).toBe(false);
    });
  });
});
