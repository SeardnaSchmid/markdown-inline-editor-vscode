import { MarkdownParser } from '../../parser';

describe('MarkdownParser - HTML Tags', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  const expectTagDecoration = (markdown: string, tag: string, decorations: ReturnType<MarkdownParser['extractDecorations']>) => {
    const start = markdown.indexOf(tag);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = start + tag.length;
    expect(decorations.some(d => d.type === 'htmlTag' && d.startPos === start && d.endPos === end)).toBe(true);
  };

  describe('basic tags', () => {
    it('should decorate opening and closing tags', () => {
      const markdown = '<strong>text</strong>';
      const result = parser.extractDecorations(markdown);

      expectTagDecoration(markdown, '<strong>', result);
      expectTagDecoration(markdown, '</strong>', result);
    });
  });

  describe('self-closing tags', () => {
    it('should decorate self-closing tags', () => {
      const markdown = '<br/>';
      const result = parser.extractDecorations(markdown);

      expectTagDecoration(markdown, '<br/>', result);
    });
  });

  describe('nested tags', () => {
    it('should decorate all nested tags', () => {
      const markdown = '<div><strong>bold</strong></div>';
      const result = parser.extractDecorations(markdown);

      expectTagDecoration(markdown, '<div>', result);
      expectTagDecoration(markdown, '<strong>', result);
      expectTagDecoration(markdown, '</strong>', result);
      expectTagDecoration(markdown, '</div>', result);
    });
  });

  describe('tags with attributes', () => {
    it('should decorate tags that include attributes', () => {
      const markdown = '<div class="note">content</div>';
      const result = parser.extractDecorations(markdown);

      expectTagDecoration(markdown, '<div class="note">', result);
      expectTagDecoration(markdown, '</div>', result);
    });
  });

  describe('html in inline code', () => {
    it('should not decorate tags inside inline code', () => {
      const markdown = '`<div>code</div>`';
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'htmlTag')).toBe(false);
    });
  });

  describe('html in code blocks', () => {
    it('should not decorate tags inside code blocks', () => {
      const markdown = '```html\n<div>code</div>\n```';
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'htmlTag')).toBe(false);
    });
  });

  describe('malformed html', () => {
    it('should decorate the valid opening tag and ignore the rest', () => {
      const markdown = '<div>unclosed';
      const result = parser.extractDecorations(markdown);

      expectTagDecoration(markdown, '<div>', result);
      expect(result.filter(d => d.type === 'htmlTag').length).toBe(1);
    });
  });
});
