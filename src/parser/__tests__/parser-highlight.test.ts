import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkdownParser } from '../core';
import { config } from '../../config';

describe('MarkdownParser - Highlight (==text==)', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('basic highlighting', () => {
    it('should hide markers and style highlight text', () => {
      const markdown = '==highlighted text==';
      const result = parser.extractDecorationsWithScopes(markdown);

      // Should have hide decorations for opening and closing ==
      const hideDecorations = result.decorations.filter((d) => d.type === 'hide');
      expect(hideDecorations.length).toBe(2);
      expect(hideDecorations[0]).toEqual({
        startPos: 0,
        endPos: 2,
        type: 'hide',
      });
      expect(hideDecorations[1]).toEqual({
        startPos: 18,
        endPos: 20,
        type: 'hide',
      });

      // Should have highlight decoration for content
      const highlightDecorations = result.decorations.filter((d) => d.type === 'highlight');
      expect(highlightDecorations.length).toBe(1);
      expect(highlightDecorations[0]).toEqual({
        startPos: 2,
        endPos: 18,
        type: 'highlight',
      });

      // Should have highlight scope
      const highlightScope = result.scopes.find((s) => s.kind === 'highlight');
      expect(highlightScope).toBeDefined();
      expect(highlightScope?.startPos).toBe(0);
      expect(highlightScope?.endPos).toBe(20);
    });

    it('should handle highlight at start of line', () => {
      const markdown = '==start== and more text';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.some((d) => d.type === 'highlight' && d.startPos === 2 && d.endPos === 7)).toBe(true);
    });

    it('should handle highlight in middle of text', () => {
      const markdown = 'before ==middle== after';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.some((d) => d.type === 'highlight' && d.startPos === 9 && d.endPos === 15)).toBe(true);
    });

    it('should handle highlight at end of line', () => {
      const markdown = 'some text ==end==';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.some((d) => d.type === 'highlight' && d.startPos === 12 && d.endPos === 15)).toBe(true);
    });

    it('should handle multiple highlights on the same line', () => {
      const markdown = '==first== and ==second==';
      const result = parser.extractDecorationsWithScopes(markdown);

      const highlightDecorations = result.decorations.filter((d) => d.type === 'highlight');
      expect(highlightDecorations.length).toBe(2);
      expect(highlightDecorations[0]).toEqual({ startPos: 2, endPos: 7, type: 'highlight' });
      expect(highlightDecorations[1]).toEqual({ startPos: 16, endPos: 22, type: 'highlight' });
    });
  });

  describe('nesting with other formatting', () => {
    it('should handle bold inside highlight', () => {
      const markdown = '==before **bold** after==';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.some((d) => d.type === 'highlight')).toBe(true);
      expect(result.decorations.some((d) => d.type === 'bold')).toBe(true);
    });

    it('should handle highlight inside bold', () => {
      const markdown = '**before ==highlight== after**';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.some((d) => d.type === 'bold')).toBe(true);
      expect(result.decorations.some((d) => d.type === 'highlight')).toBe(true);
    });

    it('should handle italic inside highlight', () => {
      const markdown = '==some *italic* text==';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.some((d) => d.type === 'highlight')).toBe(true);
      expect(result.decorations.some((d) => d.type === 'italic')).toBe(true);
    });

    it('should handle link inside highlight', () => {
      const markdown = '==visit [Example](https://example.com) today==';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.some((d) => d.type === 'highlight')).toBe(true);
      expect(result.decorations.some((d) => d.type === 'link')).toBe(true);
    });

    it('should handle inline code inside highlight', () => {
      const markdown = '==run `git status` now==';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.some((d) => d.type === 'highlight')).toBe(true);
      expect(result.decorations.some((d) => d.type === 'code')).toBe(true);
    });
  });

  describe('code block and inline code protection', () => {
    it('should NOT parse highlights inside fenced code blocks', () => {
      const markdown = '```\n==not highlighted==\n```';
      const result = parser.extractDecorationsWithScopes(markdown);

      const highlights = result.decorations.filter((d) => d.type === 'highlight');
      expect(highlights.length).toBe(0);
    });

    it('should NOT parse double equals inside inline code', () => {
      const markdown = 'Check if `a == b` before proceeding';
      const result = parser.extractDecorationsWithScopes(markdown);

      const highlights = result.decorations.filter((d) => d.type === 'highlight');
      expect(highlights.length).toBe(0);
    });
  });

  describe('flanking and syntax edge cases', () => {
    it('should ignore empty highlight markers (====)', () => {
      const markdown = 'Empty ==== here';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });

    it('should ignore opening marker with trailing space (== text==)', () => {
      const markdown = 'Invalid == text== here';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });

    it('should ignore closing marker with leading space (==text ==)', () => {
      const markdown = 'Invalid ==text == here';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });

    it('should ignore escaped markers (\\==text\\==)', () => {
      const markdown = 'Escaped \\==text\\== here';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });

    it('should NOT match across blank lines / paragraph boundaries', () => {
      const markdown = '==first paragraph\n\nsecond paragraph==';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });

    it('should ignore triple equals (===text===)', () => {
      const markdown = '===triple equals===';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });

    it('should ignore single equals (=text=)', () => {
      const markdown = '=single equals=';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });

    it('should decompose 4-equals run into closer and opener for adjacent highlights', () => {
      const markdown = '==First====Second==';
      const result = parser.extractDecorationsWithScopes(markdown);

      const highlights = result.decorations.filter((d) => d.type === 'highlight');
      expect(highlights.length).toBe(2);
      expect(highlights[0]).toEqual({ startPos: 2, endPos: 7, type: 'highlight' });
      expect(highlights[1]).toEqual({ startPos: 11, endPos: 17, type: 'highlight' });
    });

    it('should NOT match unclosed highlight across list item boundaries', () => {
      const markdown = '- Item 1: ==unclosed highlight\n- Item 2: == invalid ==';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });

    it('should NOT match unclosed highlight across heading boundary', () => {
      const markdown = '==unclosed text\n# Heading';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });

    it('should ignore invalid spacing in list items', () => {
      const markdown = '- == ungültig ==\n- ==ungültig ==\n- == ungültig==';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
    });
  });

  describe('configuration toggle', () => {
    it('should produce no highlight decorations when highlight.enabled is false', () => {
      vi.spyOn(config.highlight, 'enabled').mockReturnValue(false);

      const markdown = '==highlighted text==';
      const result = parser.extractDecorationsWithScopes(markdown);

      expect(result.decorations.filter((d) => d.type === 'highlight').length).toBe(0);
      expect(result.decorations.filter((d) => d.type === 'hide').length).toBe(0);
      expect(result.scopes.filter((s) => s.kind === 'highlight').length).toBe(0);

      vi.restoreAllMocks();
    });
  });
});
