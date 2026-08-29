import { MarkdownParser } from '../../parser';

describe('MarkdownParser - Images', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('basic image (![alt](url))', () => {
    it('should hide delimiters and style alt text', () => {
      const markdown = '![alt](url)';
      const result = parser.extractDecorations(markdown);
      
      // Should hide !, [, ], (, )
      expect(result.some(d => d.type === 'hide' && d.startPos === 0)).toBe(true); // ![
      expect(result.some(d => d.type === 'hide' && d.startPos === 5)).toBe(true); // ]
      expect(result.some(d => d.type === 'hide' && d.startPos === 6)).toBe(true); // (
      expect(result.some(d => d.type === 'hide' && d.startPos === 10)).toBe(true); // )
      // Should hide URL content
      expect(result.some(d => d.type === 'hide' && d.startPos === 7 && d.endPos === 10)).toBe(true); // url
      
      // Should style alt text as image
      expect(result).toContainEqual({
        startPos: 2,
        endPos: 5,
        type: 'image',
        url: 'url',
      });
    });
  });

  describe('image with alt text', () => {
    it('should handle image with alt text', () => {
      const markdown = '![alt text](image.png)';
      const result = parser.extractDecorations(markdown);
      
      const imageDec = result.find(d => d.type === 'image');
      expect(imageDec).toBeDefined();
      expect(imageDec?.startPos).toBe(2);
      expect(imageDec?.endPos).toBe(10);
    });
  });

  describe('image at start of line', () => {
    it('should handle image at line start', () => {
      const markdown = '![alt](url) text';
      const result = parser.extractDecorations(markdown);
      
      const imageDec = result.find(d => d.type === 'image');
      expect(imageDec).toBeDefined();
      expect(imageDec?.startPos).toBe(2);
    });
  });

  describe('image at end of line', () => {
    it('should handle image at line end', () => {
      const markdown = 'text ![alt](url)';
      const result = parser.extractDecorations(markdown);
      
      const imageDec = result.find(d => d.type === 'image');
      expect(imageDec).toBeDefined();
      expect(imageDec?.startPos).toBeGreaterThan(5);
    });
  });

  describe('image in middle of text', () => {
    it('should handle image in middle of text', () => {
      const markdown = 'start ![alt](url) end';
      const result = parser.extractDecorations(markdown);
      
      const imageDec = result.find(d => d.type === 'image');
      expect(imageDec).toBeDefined();
      expect(imageDec?.startPos).toBeGreaterThan(6);
      expect(imageDec?.endPos).toBeLessThan(17);
    });
  });

  describe('image with spaces in alt', () => {
    it('should handle image with spaces in alt', () => {
      const markdown = '![alt text](url)';
      const result = parser.extractDecorations(markdown);
      
      const imageDec = result.find(d => d.type === 'image');
      expect(imageDec).toBeDefined();
      expect(imageDec?.startPos).toBe(2);
      expect(imageDec?.endPos).toBe(10);
    });
  });

  describe('image with special characters in alt', () => {
    it('should handle image with special characters in alt', () => {
      const markdown = '![alt!@#](url)';
      const result = parser.extractDecorations(markdown);
      
      const imageDec = result.find(d => d.type === 'image');
      expect(imageDec).toBeDefined();
      expect(imageDec?.startPos).toBe(2);
      expect(imageDec?.endPos).toBe(8);
    });
  });

  describe('multiple images in same line', () => {
    it('should handle multiple images', () => {
      const markdown = '![one](url1) and ![two](url2)';
      const result = parser.extractDecorations(markdown);
      
      const imageDecs = result.filter(d => d.type === 'image');
      expect(imageDecs.length).toBe(2);
      
      // First image: "one"
      expect(imageDecs[0].startPos).toBe(2);
      expect(imageDecs[0].endPos).toBe(5);
      
      // Second image: "two"
      expect(imageDecs[1].startPos).toBe(19);
      expect(imageDecs[1].endPos).toBe(22);
    });
  });

  describe('image with empty alt', () => {
    it('should handle image with empty alt gracefully', () => {
      const markdown = '![]';
      const result = parser.extractDecorations(markdown);
      
      // Should still hide delimiters
      expect(result.some(d => d.type === 'hide')).toBe(true);
      // May or may not have image decoration for empty alt
    });
  });

  describe('image with formatting in alt', () => {
    it('should preserve bold formatting inside image alt text', () => {
      const markdown = '![**Bold** alt](image.png)';
      const result = parser.extractDecorations(markdown);

      // The image alt text should carry the URL for hover/click behaviors
      const imageDec = result.find(d => d.type === 'image');
      expect(imageDec).toBeDefined();
      expect(imageDec?.url).toBe('image.png');

      // Bold markers should be hidden and bold content styled
      expect(result.some(d => d.type === 'hide' && d.startPos === 2 && d.endPos === 4)).toBe(true); // opening **
      expect(result.some(d => d.type === 'bold' && d.startPos === 4 && d.endPos === 8)).toBe(true); // Bold
      expect(result.some(d => d.type === 'hide' && d.startPos === 8 && d.endPos === 10)).toBe(true); // closing **

      // Image path should be hidden (including parentheses and content)
      expect(result.some(d => d.type === 'hide' && d.startPos === 15 && d.endPos === 16)).toBe(true); // (
      expect(result.some(d => d.type === 'hide' && d.startPos === 16 && d.endPos === 25)).toBe(true); // image.png
      expect(result.some(d => d.type === 'hide' && d.startPos === 25 && d.endPos === 26)).toBe(true); // )
    });

    it('should preserve italic formatting inside image alt text', () => {
      const markdown = '![*Italic* alt text](image.png)';
      const result = parser.extractDecorations(markdown);

      // Italic markers should be hidden and italic content styled
      expect(result.some(d => d.type === 'hide' && d.startPos === 2 && d.endPos === 3)).toBe(true); // opening *
      expect(result.some(d => d.type === 'italic' && d.startPos === 3 && d.endPos === 9)).toBe(true); // Italic
      expect(result.some(d => d.type === 'hide' && d.startPos === 9 && d.endPos === 10)).toBe(true); // closing *
    });
  });

  describe('image with parentheses in URL', () => {
    it('should hide entire URL and closing parenthesis when URL contains parentheses', () => {
      const markdown = '![Diagram](https://example.com/assets/diagram_(v1).png)';
      const result = parser.extractDecorations(markdown);

      const imageDec = result.find(d => d.type === 'image');
      expect(imageDec).toBeDefined();
      expect(imageDec?.url).toBe('https://example.com/assets/diagram_(v1).png');

      // The closing parenthesis of the image (last char) must be hidden
      expect(
        result.some(
          d => d.type === 'hide' && d.startPos === markdown.length - 1 && d.endPos === markdown.length
        )
      ).toBe(true);
    });
  });
});

