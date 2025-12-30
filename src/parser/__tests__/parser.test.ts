import { MarkdownParser } from '../../parser';

describe('MarkdownParser', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('instantiation', () => {
    it('should create a MarkdownParser instance', () => {
      expect(parser).toBeInstanceOf(MarkdownParser);
    });
  });

  describe('empty input handling', () => {
    it('should return empty array for empty string', () => {
      const result = parser.extractDecorations('');
      expect(result).toEqual([]);
    });

    it('should return empty array for null input', () => {
      const result = parser.extractDecorations(null as any);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      const result = parser.extractDecorations(undefined as any);
      expect(result).toEqual([]);
    });
  });

  describe('whitespace handling', () => {
    it('should return empty array for whitespace only', () => {
      const result = parser.extractDecorations('   ');
      expect(result).toEqual([]);
    });

    it('should return empty array for newline only', () => {
      const result = parser.extractDecorations('\n');
      expect(result).toEqual([]);
    });

    it('should return empty array for multiple newlines', () => {
      const result = parser.extractDecorations('\n\n\n');
      expect(result).toEqual([]);
    });
  });

  describe('line ending normalization', () => {
    it('should handle CRLF line endings', () => {
      const markdown = '# Heading\r\n**bold**';
      const result = parser.extractDecorations(markdown);
      expect(result.length).toBeGreaterThan(0);
      // Should find heading and bold decorations
      expect(result.some(d => d.type === 'heading1')).toBe(true);
      expect(result.some(d => d.type === 'bold')).toBe(true);
    });

    it('should handle CR line endings', () => {
      const markdown = '# Heading\r**bold**';
      const result = parser.extractDecorations(markdown);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(d => d.type === 'heading1')).toBe(true);
      expect(result.some(d => d.type === 'bold')).toBe(true);
    });

    it('should handle LF line endings', () => {
      const markdown = '# Heading\n**bold**';
      const result = parser.extractDecorations(markdown);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(d => d.type === 'heading1')).toBe(true);
      expect(result.some(d => d.type === 'bold')).toBe(true);
    });

    it('should handle mixed line endings', () => {
      const markdown = '# Heading\r\n**bold**\r*italic*';
      const result = parser.extractDecorations(markdown);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(d => d.type === 'heading1')).toBe(true);
      expect(result.some(d => d.type === 'bold')).toBe(true);
      expect(result.some(d => d.type === 'italic')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return empty array for malformed markdown gracefully', () => {
      // Very malformed markdown that might cause parse errors
      const markdown = '***\n***\n***';
      const result = parser.extractDecorations(markdown);
      // Should not throw, should return array (may be empty or have some decorations)
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle unclosed formatting gracefully', () => {
      const markdown = '**unclosed bold';
      const result = parser.extractDecorations(markdown);
      expect(Array.isArray(result)).toBe(true);
      // May return empty or partial decorations
    });
  });

  describe('decoration sorting', () => {
    it('should return decorations sorted by startPos', () => {
      const markdown = '# Heading\n**bold** text';
      const result = parser.extractDecorations(markdown);
      
      for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const previous = result[i - 1];
        if (current && previous) {
          expect(current.startPos).toBeGreaterThanOrEqual(previous.startPos);
        }
      }
    });
  });

  describe('ordered lists', () => {
    it('should not apply listItem decoration to ordered lists without checkboxes', () => {
      const markdown = '1. First item\n2. Second item\n3. Third item';
      const result = parser.extractDecorations(markdown);
      
      // Ordered lists without checkboxes should not have listItem decorations
      // They should be displayed as-is (markers visible)
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should handle ordered lists with dot markers', () => {
      const markdown = '1. Item one\n2. Item two';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should handle ordered lists with parentheses markers', () => {
      const markdown = '1) Item one\n2) Item two';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should handle multi-digit ordered list numbers', () => {
      const markdown = '123. Item one\n456. Item two';
      const result = parser.extractDecorations(markdown);
      
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBe(0);
    });

    it('should still apply listItem decoration to ordered lists with checkboxes', () => {
      const markdown = '1. [ ] Task item';
      const result = parser.extractDecorations(markdown);
      
      // Ordered lists with checkboxes should have listItem decoration
      const listItemDecorations = result.filter(d => d.type === 'listItem');
      expect(listItemDecorations.length).toBeGreaterThan(0);
    });
  });
});

