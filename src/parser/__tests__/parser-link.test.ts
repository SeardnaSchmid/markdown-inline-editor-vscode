import { MarkdownParser } from '../../parser';

describe('MarkdownParser - Links', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('basic link ([text](url))', () => {
    it('should hide delimiters and style link text', () => {
      const markdown = '[text](url)';
      const result = parser.extractDecorations(markdown);
      
      // Should hide [, ], (, )
      expect(result.some(d => d.type === 'hide' && d.startPos === 0)).toBe(true); // [
      expect(result.some(d => d.type === 'hide' && d.startPos === 5)).toBe(true); // ]
      expect(result.some(d => d.type === 'hide' && d.startPos === 6)).toBe(true); // (
      expect(result.some(d => d.type === 'hide' && d.startPos === 10)).toBe(true); // )
      
      // Should style text as link
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.endPos).toBe(5);
    });
  });

  describe('link with full URL', () => {
    it('should handle link with full URL', () => {
      const markdown = '[link text](https://example.com)';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.endPos).toBe(10);
    });
  });

  describe('link at start of line', () => {
    it('should handle link at line start', () => {
      const markdown = '[link](url) text';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBe(1);
    });
  });

  describe('link at end of line', () => {
    it('should handle link at line end', () => {
      const markdown = 'text [link](url)';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBeGreaterThan(5);
    });
  });

  describe('link in middle of text', () => {
    it('should handle link in middle of text', () => {
      const markdown = 'start [link](url) end';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBeGreaterThan(6);
      expect(linkDec?.endPos).toBeLessThan(17);
    });
  });

  describe('link with spaces in text', () => {
    it('should handle link with spaces in text', () => {
      const markdown = '[link text](url)';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.endPos).toBe(10);
    });
  });

  describe('link with special characters in text', () => {
    it('should handle link with special characters', () => {
      const markdown = '[link!@#](url)';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.endPos).toBe(8);
    });
  });

  describe('bracket-style link where label equals URL or email', () => {
    it('should render [user@example.com](mailto:user@example.com) as regular link (hide delimiters and URL)', () => {
      const markdown = '[user@example.com](mailto:user@example.com)';
      const result = parser.extractDecorations(markdown);

      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.endPos).toBe(17); // "user@example.com" between brackets
      expect(linkDec?.url).toBe('mailto:user@example.com');

      const hideDecs = result.filter(d => d.type === 'hide');
      expect(result.some(d => d.type === 'hide' && d.startPos === 0)).toBe(true); // [
      expect(result.some(d => d.type === 'hide' && d.startPos === 17)).toBe(true); // ]
      expect(result.some(d => d.type === 'hide' && d.startPos === 18)).toBe(true); // (
      expect(hideDecs.length).toBe(5); // [, ], (, URL content, )
    });

    it('should render [https://example.com](https://example.com) as regular link', () => {
      const markdown = '[https://example.com](https://example.com)';
      const result = parser.extractDecorations(markdown);

      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.url).toBe('https://example.com');

      // Bracket-style: opening [ and delimiters/URL must be hidden
      expect(result.some(d => d.type === 'hide' && d.startPos === 0)).toBe(true); // [
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('multiple links in same line', () => {
    it('should handle multiple links', () => {
      const markdown = '[one](url1) and [two](url2)';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(2);
      
      // First link: "one"
      expect(linkDecs[0].startPos).toBe(1);
      expect(linkDecs[0].endPos).toBe(4);
      
      // Second link: "two"
      expect(linkDecs[1].startPos).toBe(17);
      expect(linkDecs[1].endPos).toBe(20);
    });
  });

  describe('link with empty text', () => {
    it('should handle link with empty text gracefully', () => {
      const markdown = '[](url)';
      const result = parser.extractDecorations(markdown);
      
      // Should still hide delimiters
      expect(result.some(d => d.type === 'hide')).toBe(true);
      // May or may not have link decoration for empty text
    });
  });

  describe('link with empty URL', () => {
    it('should handle link with empty URL gracefully', () => {
      const markdown = '[text]()';
      const result = parser.extractDecorations(markdown);
      
      // Should still style text as link
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.endPos).toBe(5);
    });
  });

  describe('links inside code blocks', () => {
    it('should NOT parse links inside fenced code blocks', () => {
      const markdown = '```\n[link](url)\n```';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(0);
      
      // Should have code block decoration instead
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
    });

    it('should NOT parse links inside inline code', () => {
      const markdown = '`[link](url)`';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(0);
      
      // Should have inline code decoration instead
      const codeDec = result.find(d => d.type === 'code');
      expect(codeDec).toBeDefined();
    });

    it('should NOT parse links inside code blocks with language', () => {
      const markdown = '```markdown\n[link](url)\n```';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(0);
    });

    it('should still parse links outside code blocks', () => {
      const markdown = '```\ncode\n```\n[link](url)';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(1);
      expect(linkDecs[0].startPos).toBeGreaterThan(10); // After the code block
    });

    it('should handle multiple code blocks with links inside and outside', () => {
      const markdown = '```\n[link1](url1)\n```\n[link2](url2)\n```\n[link3](url3)\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should only have ONE link decoration (the one outside code blocks)
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(1);
      // The link should be "link2"
      expect(linkDecs[0]).toBeDefined();
    });

    it('should NOT parse links inside mermaid code blocks', () => {
      const markdown = '```mermaid\ngraph TD\nA[Start] --> B{Is Markdown beautiful?}\nB -- Yes --> C[More readable!]\nB -- No --> D[Try Mermaid diagrams]\nD --> E[Visualize ideas]\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should NOT have any link decorations inside the mermaid block
      // Even though "Start" looks like it could be a link, it's inside a code block
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(0);
      
      // Should have mermaid block (but not codeBlock decoration for mermaid)
      const parseResult = parser.extractDecorationsWithScopes(markdown);
      expect(parseResult.mermaidBlocks.length).toBe(1);
    });
  });

  describe('autolinks (angle bracket syntax)', () => {
    it('should hide angle brackets and style URL autolink', () => {
      const markdown = '<http://example.com>';
      const result = parser.extractDecorations(markdown);
      
      // Should hide < and >
      expect(result.some(d => d.type === 'hide' && d.startPos === 0)).toBe(true); // <
      expect(result.some(d => d.type === 'hide' && d.startPos === 19)).toBe(true); // >
      
      // Should style URL as link
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.endPos).toBe(19);
      expect(linkDec?.url).toBe('http://example.com');
    });

    it('should handle HTTPS URL autolink', () => {
      const markdown = '<https://github.com/user/repo>';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('https://github.com/user/repo');
    });

    it('should handle URL autolink with query parameters', () => {
      const markdown = '<https://example.com/path?query=value>';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('https://example.com/path?query=value');
      // Should hide both angle brackets
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBe(2);
    });

    it('should handle email autolink with mailto prefix', () => {
      const markdown = '<user@example.com>';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('mailto:user@example.com');
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.endPos).toBe(17); // 17 = end of "user@example.com" (exclusive)
    });

    it('should handle email autolink with plus addressing', () => {
      const markdown = '<user+tag@example.com>';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('mailto:user+tag@example.com');
    });

    it('should handle autolink in paragraph text', () => {
      const markdown = 'Visit <https://example.com> for info';
      const result = parser.extractDecorations(markdown);
      
      // Should only hide the autolink brackets, not other text
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('https://example.com');
      // Should have exactly 2 hide decorations (the angle brackets)
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBe(2);
    });

    it('should handle multiple autolinks in same line', () => {
      const markdown = 'Contact <user@example.com> or <https://example.com>';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(2);
      
      // First link: email
      expect(linkDecs[0].url).toBe('mailto:user@example.com');
      // Second link: URL
      expect(linkDecs[1].url).toBe('https://example.com');
      
      // Should have 4 hide decorations (2 angle brackets per autolink)
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBe(4);
    });

    it('should handle autolink adjacent to text', () => {
      const markdown = 'URL:<https://example.com>text';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('https://example.com');
      // Only the autolink should be styled as link, not adjacent text
      expect(linkDec?.startPos).toBeGreaterThan(4); // After "URL:"
      expect(linkDec?.endPos).toBeLessThan(25); // Before "text"
    });

    it('should NOT parse autolinks inside code blocks', () => {
      const markdown = '```\n<https://example.com>\n```';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(0);
    });

    it('should NOT parse autolinks inside inline code', () => {
      const markdown = '`<https://example.com>`';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(0);
    });
  });

  describe('bare links (without angle brackets)', () => {
    it('should style bare email as link without hiding anything', () => {
      const markdown = 'user@example.com';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('mailto:user@example.com');
      expect(linkDec?.startPos).toBe(0);
      expect(linkDec?.endPos).toBe(16);
      
      // Should NOT have hide decorations (no brackets to hide)
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBe(0);
    });

    it('should style bare URL as link without hiding anything', () => {
      const markdown = 'https://example.com';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('https://example.com');
      
      // Should NOT have hide decorations
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBe(0);
    });

    it('should handle bare email with plus addressing', () => {
      const markdown = 'user+tag@example.com';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('mailto:user+tag@example.com');
    });

    it('should handle bare link in paragraph text', () => {
      const markdown = 'Visit https://example.com for info';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('https://example.com');
      // Should NOT have hide decorations
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBe(0);
    });

    it('should handle multiple bare links in same line', () => {
      const markdown = 'Contact user@example.com or https://example.com';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(2);
      
      // First link: email
      expect(linkDecs[0].url).toBe('mailto:user@example.com');
      // Second link: URL
      expect(linkDecs[1].url).toBe('https://example.com');
      
      // Should NOT have hide decorations
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBe(0);
    });

    it('should NOT parse bare links inside code blocks', () => {
      const markdown = '```\nhttps://example.com\n```';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(0);
    });

    it('should NOT parse bare links inside inline code', () => {
      const markdown = '`https://example.com`';
      const result = parser.extractDecorations(markdown);
      
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(0);
    });
  });

  describe('link with parentheses in URL', () => {
    it('should hide entire URL and closing parenthesis when URL contains parentheses', () => {
      const markdown = '[Wikipedia](https://en.wikipedia.org/wiki/Function_(mathematics))';
      const result = parser.extractDecorations(markdown);
      
      const linkDec = result.find(d => d.type === 'link');
      expect(linkDec).toBeDefined();
      expect(linkDec?.url).toBe('https://en.wikipedia.org/wiki/Function_(mathematics)');
      expect(linkDec?.startPos).toBe(1);
      expect(linkDec?.endPos).toBe(10); // 'Wikipedia'

      // The entire URL content should be hidden
      expect(result.some(d => d.type === 'hide' && d.startPos === 12 && d.endPos === 64)).toBe(true);
      // The closing parenthesis of the link (last char) must be hidden
      expect(result.some(d => d.type === 'hide' && d.startPos === 64 && d.endPos === 65)).toBe(true);
    });

    it('should hide entire URL when URL has nested parentheses and trailing path', () => {
      const markdown = '[Release Notes](https://example.com/item_(v2)_final)';
      const result = parser.extractDecorations(markdown);

      // The closing parenthesis of the link must be hidden
      expect(
        result.some(
          d => d.type === 'hide' && d.startPos === markdown.length - 1 && d.endPos === markdown.length
        )
      ).toBe(true);
    });
  });
});

