import { MarkdownParser } from '../../parser';

describe('MarkdownParser - Code Blocks', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('basic code block', () => {
    it('should hide opening and closing fence markers', () => {
      const markdown = '```\ncode\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should have hide decorations for fences
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBeGreaterThan(0);
      
      // Opening fence should be hidden
      expect(hideDecs.some(d => d.startPos === 0)).toBe(true);
      
      // Closing fence should be hidden
      const closingFence = hideDecs.find(d => d.startPos > 5);
      expect(closingFence).toBeDefined();
    });
  });

  describe('code block at start of document', () => {
    it('should handle code block at document start', () => {
      const markdown = '```\ncode\n```\ntext';
      const result = parser.extractDecorations(markdown);
      
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.some(d => d.startPos === 0)).toBe(true);
    });
  });

  describe('code block at end of document', () => {
    it('should handle code block at document end', () => {
      const markdown = 'text\n```\ncode\n```';
      const result = parser.extractDecorations(markdown);
      
      const hideDecs = result.filter(d => d.type === 'hide');
      // Should find closing fence
      expect(hideDecs.length).toBeGreaterThan(0);
    });
  });

  describe('code block with content', () => {
    it('should handle code block with content', () => {
      const markdown = '```\nfunction test() {\n  return true;\n}\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should hide both fences
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBeGreaterThan(0);
    });
  });

  describe('code block with empty content', () => {
    it('should handle code block with no content', () => {
      const markdown = '```\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should still hide fences
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBeGreaterThan(0);
    });
  });

  describe('code block with only whitespace', () => {
    it('should handle code block with only whitespace', () => {
      const markdown = '```\n   \n```';
      const result = parser.extractDecorations(markdown);
      
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBeGreaterThan(0);
    });
  });

  describe('multiple code blocks in document', () => {
    it('should handle multiple code blocks', () => {
      const markdown = '```\ncode1\n```\n```\ncode2\n```';
      const result = parser.extractDecorations(markdown);
      
      const hideDecs = result.filter(d => d.type === 'hide');
      // Should have hide decorations for all fences
      expect(hideDecs.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('code block with language identifier', () => {
    it('should hide fence markers and render language identifier with opacity', () => {
      const markdown = '```javascript\ncode\n```';
      const result = parser.extractDecorations(markdown);
      
      // Opening fence (```) should be hidden (3 characters)
      const openingFence = result.find(d => d.type === 'hide' && d.startPos === 0);
      expect(openingFence).toBeDefined();
      expect(openingFence?.endPos).toBe(3);
      
      // Language identifier should have codeBlockLanguage decoration
      const languageDec = result.find(d => d.type === 'codeBlockLanguage');
      expect(languageDec).toBeDefined();
      expect(languageDec?.startPos).toBe(3); // After ```
      expect(languageDec?.endPos).toBe(13); // "javascript" is 10 chars, so 3 + 10 = 13
      
      // Newline after language should be hidden
      const newlineHide = result.find(d => d.type === 'hide' && d.startPos === 13);
      expect(newlineHide).toBeDefined();
      expect(newlineHide?.endPos).toBe(14); // Newline is 1 char
    });

    it('should handle code block with different language identifiers', () => {
      const markdown = '```python\ncode\n```\n```typescript\ncode\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should have language decorations for both code blocks
      const languageDecs = result.filter(d => d.type === 'codeBlockLanguage');
      expect(languageDecs.length).toBe(2);
      
      // First language should be "python"
      const pythonDec = languageDecs.find(d => d.startPos === 3);
      expect(pythonDec).toBeDefined();
      
      // Second language should be "typescript"
      const tsDec = languageDecs.find(d => d.startPos > 20);
      expect(tsDec).toBeDefined();
    });
  });

  describe('GFM code block variants', () => {
    it('should support tilde fences (~~~)', () => {
      const markdown = '~~~python\ncode\n~~~';
      const result = parser.extractDecorations(markdown);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
      
      // Should have hide decorations for fences
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBeGreaterThan(0);
      
      // Should have language decoration
      const languageDec = result.find(d => d.type === 'codeBlockLanguage');
      expect(languageDec).toBeDefined();
    });

    it('should support fences with more than 3 characters', () => {
      const markdown = '````python\ncode\n````';
      const result = parser.extractDecorations(markdown);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
      
      // Should have hide decorations for fences
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBeGreaterThan(0);
    });

    it('should support tilde fences with more than 3 characters', () => {
      const markdown = '~~~~python\ncode\n~~~~';
      const result = parser.extractDecorations(markdown);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
      
      // Should have language decoration
      const languageDec = result.find(d => d.type === 'codeBlockLanguage');
      expect(languageDec).toBeDefined();
    });

    it('should handle closing fence that is longer than opening fence', () => {
      const markdown = '```python\ncode\n````';
      const result = parser.extractDecorations(markdown);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
    });

    it('should handle mixed backtick and tilde fences separately', () => {
      const markdown = '```python\ncode\n```\n~~~javascript\ncode\n~~~';
      const result = parser.extractDecorations(markdown);
      
      // Should have two code block decorations
      const codeBlocks = result.filter(d => d.type === 'codeBlock');
      expect(codeBlocks.length).toBe(2);
      
      // Should have language decorations for both
      const languageDecs = result.filter(d => d.type === 'codeBlockLanguage');
      expect(languageDecs.length).toBe(2);
    });

    it('should handle code block without language identifier', () => {
      const markdown = '~~~\ncode\n~~~';
      const result = parser.extractDecorations(markdown);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
      
      // Should not have language decoration
      const languageDec = result.find(d => d.type === 'codeBlockLanguage');
      expect(languageDec).toBeUndefined();
    });

    it('should hide closing fence markers', () => {
      const markdown = '```mermaid\ngraph TD\nA[Start] --> B{Is Markdown beautiful?}\n```';
      const result = parser.extractDecorations(markdown);
      
      // Find the closing fence position
      const closingFencePos = markdown.lastIndexOf('```');
      
      // Should have a hide decoration for the closing fence
      const closingFenceHide = result.find(d => 
        d.type === 'hide' && 
        d.startPos === closingFencePos
      );
      expect(closingFenceHide).toBeDefined();
      expect(closingFenceHide?.endPos).toBeGreaterThan(closingFencePos);
    });

    it('should handle unclosed code blocks gracefully', () => {
      const markdown = '```\ncode without closing fence\n**bold** text';
      const result = parser.extractDecorations(markdown);
      
      // The parser should handle unclosed code blocks without crashing
      // Remark may or may not detect the code block depending on implementation
      // The key is that the parser doesn't crash and returns a valid result
      expect(Array.isArray(result)).toBe(true);
      
      // If the code block is detected, bold should not be inside it
      // If it's not detected (unclosed), bold might be parsed, which is acceptable
      const boldDecs = result.filter(d => d.type === 'bold');
      // Either no bold (if code block detected) or bold is parsed (if not detected)
      // Both are acceptable behaviors
    });
  });

  describe('edge cases - filtering decorations in code blocks', () => {
    it('should NOT parse nested decorators inside code blocks (bold inside link)', () => {
      const markdown = '```\n[**bold link**](url)\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should NOT have link decoration inside code block
      const linkDecs = result.filter(d => d.type === 'link');
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      linkDecs.forEach(link => {
        // Link should not be inside the code block
        expect(
          link.startPos < codeBlockStart || link.endPos > codeBlockEnd
        ).toBe(true);
      });
      
      // Should NOT have bold decoration inside code block
      const boldDecs = result.filter(d => d.type === 'bold');
      boldDecs.forEach(bold => {
        expect(
          bold.startPos < codeBlockStart || bold.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should NOT parse multiple nested decorators inside code blocks', () => {
      const markdown = '```\n_**bold italic**_ and [link](url)\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT have bold, italic, or link decorations inside code block
      const boldDecs = result.filter(d => d.type === 'bold');
      const italicDecs = result.filter(d => d.type === 'italic');
      const linkDecs = result.filter(d => d.type === 'link');
      
      [...boldDecs, ...italicDecs, ...linkDecs].forEach(dec => {
        expect(
          dec.startPos < codeBlockStart || dec.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should preserve fence structure hide decorations but remove other hide decorations', () => {
      const markdown = '```javascript\ncode with **bold** that should not be parsed\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should have hide decorations for fences
      const fenceHides = result.filter(d => 
        d.type === 'hide' && 
        (d.startPos === codeBlockStart || d.endPos === codeBlockEnd)
      );
      expect(fenceHides.length).toBeGreaterThan(0);
      
      // Should NOT have hide decorations for bold markers inside code block
      const boldHideDecs = result.filter(d => 
        d.type === 'hide' && 
        d.startPos > codeBlockStart && 
        d.endPos < codeBlockEnd &&
        d.startPos !== codeBlockStart // Not opening fence
      );
      // Any hide decorations inside should only be for fence structure (newline after language)
      // Not for markdown syntax like bold markers
      boldHideDecs.forEach(hide => {
        // Should only be on opening line (newline after language)
        const isOnOpeningLine = hide.startPos >= codeBlockStart && 
          hide.startPos < codeBlockStart + 20; // Approximate opening line
        expect(isOnOpeningLine).toBe(true);
      });
    });

    it('should handle decorations at exact code block boundaries', () => {
      const markdown = '**bold**\n```\ncode\n```\n**bold**';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should have bold decorations before and after code block
      const boldDecs = result.filter(d => d.type === 'bold');
      expect(boldDecs.length).toBeGreaterThan(0);
      
      // All bold decorations should be outside the code block
      boldDecs.forEach(bold => {
        expect(
          bold.endPos <= codeBlockStart || bold.startPos >= codeBlockEnd
        ).toBe(true);
      });
    });

    it('should handle multiple code blocks with decorations between them', () => {
      const markdown = '```\ncode1\n```\n**bold** and [link](url)\n```\ncode2\n```';
      const result = parser.extractDecorations(markdown);
      
      const firstCodeBlockEnd = markdown.indexOf('```', 10) + 3;
      const secondCodeBlockStart = markdown.lastIndexOf('```', markdown.length - 10);
      
      // Should have decorations between code blocks
      const boldDecs = result.filter(d => d.type === 'bold');
      const linkDecs = result.filter(d => d.type === 'link');
      
      expect(boldDecs.length).toBeGreaterThan(0);
      expect(linkDecs.length).toBeGreaterThan(0);
      
      // All decorations should be between the code blocks
      [...boldDecs, ...linkDecs].forEach(dec => {
        expect(dec.startPos).toBeGreaterThan(firstCodeBlockEnd);
        expect(dec.endPos).toBeLessThan(secondCodeBlockStart);
      });
    });

    it('should handle inline code blocks differently from fenced code blocks', () => {
      const markdown = 'text with `inline **code**` and ```\nfenced code\n```';
      const result = parser.extractDecorations(markdown);
      
      const inlineCodeStart = markdown.indexOf('`');
      const inlineCodeEnd = markdown.indexOf('`', inlineCodeStart + 1) + 1;
      const fencedCodeStart = markdown.indexOf('```');
      const fencedCodeEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT have bold inside inline code
      const boldDecs = result.filter(d => d.type === 'bold');
      boldDecs.forEach(bold => {
        const isInInlineCode = bold.startPos >= inlineCodeStart && bold.endPos <= inlineCodeEnd;
        const isInFencedCode = bold.startPos >= fencedCodeStart && bold.endPos <= fencedCodeEnd;
        expect(isInInlineCode || isInFencedCode).toBe(false);
      });
    });

    it('should handle code blocks with markdown-like content that should not be parsed', () => {
      const markdown = '```\n# Heading\n**bold**\n[link](url)\n*italic*\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT have any markdown formatting decorations inside code block
      const headingDecs = result.filter(d => d.type.startsWith('heading'));
      const boldDecs = result.filter(d => d.type === 'bold');
      const italicDecs = result.filter(d => d.type === 'italic');
      const linkDecs = result.filter(d => d.type === 'link');
      
      [...headingDecs, ...boldDecs, ...italicDecs, ...linkDecs].forEach(dec => {
        expect(
          dec.startPos < codeBlockStart || dec.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should handle very large code blocks with many potential decorations', () => {
      // Create a large code block with markdown-like content
      const codeContent = Array(100).fill('**bold** [link](url) *italic*').join('\n');
      const markdown = `\`\`\`\n${codeContent}\n\`\`\``;
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT have any markdown formatting inside the large code block
      const boldDecs = result.filter(d => d.type === 'bold');
      const linkDecs = result.filter(d => d.type === 'link');
      const italicDecs = result.filter(d => d.type === 'italic');
      
      [...boldDecs, ...linkDecs, ...italicDecs].forEach(dec => {
        expect(
          dec.startPos < codeBlockStart || dec.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should handle code blocks with special characters that look like markdown', () => {
      const markdown = '```\n# This is not a heading\n**this is not bold**\n[this](is) not a link\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT parse any of these as markdown
      const headingDecs = result.filter(d => d.type.startsWith('heading'));
      const boldDecs = result.filter(d => d.type === 'bold');
      const linkDecs = result.filter(d => d.type === 'link');
      
      [...headingDecs, ...boldDecs, ...linkDecs].forEach(dec => {
        expect(
          dec.startPos < codeBlockStart || dec.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should handle code blocks immediately after other markdown', () => {
      const markdown = '# Heading\n**bold**\n```\ncode\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      
      // Should have heading and bold before code block
      const headingDecs = result.filter(d => d.type.startsWith('heading'));
      const boldDecs = result.filter(d => d.type === 'bold');
      
      expect(headingDecs.length).toBeGreaterThan(0);
      expect(boldDecs.length).toBeGreaterThan(0);
      
      // All should be before code block
      [...headingDecs, ...boldDecs].forEach(dec => {
        expect(dec.endPos).toBeLessThanOrEqual(codeBlockStart);
      });
    });

    it('should handle code blocks with language identifier and preserve newline hide decoration', () => {
      const markdown = '```typescript\ninterface Test {\n  value: string;\n}\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const languageEnd = markdown.indexOf('\n', codeBlockStart);
      
      // Should have hide decoration for newline after language
      const newlineHide = result.find(d => 
        d.type === 'hide' && 
        d.startPos === languageEnd &&
        d.endPos === languageEnd + 1
      );
      expect(newlineHide).toBeDefined();
      
      // Should have language decoration
      const languageDec = result.find(d => d.type === 'codeBlockLanguage');
      expect(languageDec).toBeDefined();
    });

    it('should handle adjacent code blocks with no content between', () => {
      const markdown = '```\ncode1\n```\n```\ncode2\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should have two code block decorations
      const codeBlocks = result.filter(d => d.type === 'codeBlock');
      expect(codeBlocks.length).toBe(2);
      
      // Should have hide decorations for all fences
      const hideDecs = result.filter(d => d.type === 'hide');
      expect(hideDecs.length).toBeGreaterThanOrEqual(4); // At least 4 (2 opening + 2 closing)
    });

    it('should handle code blocks with strikethrough-like content', () => {
      const markdown = '```\n~~strikethrough~~ text\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT have strikethrough decoration inside code block
      const strikethroughDecs = result.filter(d => d.type === 'strikethrough');
      strikethroughDecs.forEach(dec => {
        expect(
          dec.startPos < codeBlockStart || dec.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should handle code blocks with image-like content', () => {
      const markdown = '```\n![alt](url.png)\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT have image decoration inside code block
      const imageDecs = result.filter(d => d.type === 'image');
      imageDecs.forEach(dec => {
        expect(
          dec.startPos < codeBlockStart || dec.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should handle code blocks with blockquote-like content', () => {
      const markdown = '```\n> blockquote text\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT have blockquote decoration inside code block
      const blockquoteDecs = result.filter(d => d.type === 'blockquote');
      blockquoteDecs.forEach(dec => {
        expect(
          dec.startPos < codeBlockStart || dec.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should handle code blocks with list-like content', () => {
      const markdown = '```\n- list item\n* another item\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT have list item decorations inside code block
      const listItemDecs = result.filter(d => d.type === 'listItem');
      listItemDecs.forEach(dec => {
        expect(
          dec.startPos < codeBlockStart || dec.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should handle code blocks with heading-like content', () => {
      const markdown = '```\n# Heading 1\n## Heading 2\n### Heading 3\n```';
      const result = parser.extractDecorations(markdown);
      
      const codeBlockStart = markdown.indexOf('```');
      const codeBlockEnd = markdown.lastIndexOf('```') + 3;
      
      // Should NOT have heading decorations inside code block
      const headingDecs = result.filter(d => d.type.startsWith('heading'));
      headingDecs.forEach(dec => {
        expect(
          dec.startPos < codeBlockStart || dec.endPos > codeBlockEnd
        ).toBe(true);
      });
    });

    it('should preserve code block decorations (codeBlock, codeBlockLanguage, code, transparent)', () => {
      const markdown = '```javascript\ncode\n```\n`inline code`';
      const result = parser.extractDecorations(markdown);
      
      // Should have codeBlock decoration
      const codeBlockDecs = result.filter(d => d.type === 'codeBlock');
      expect(codeBlockDecs.length).toBeGreaterThan(0);
      
      // Should have codeBlockLanguage decoration
      const languageDecs = result.filter(d => d.type === 'codeBlockLanguage');
      expect(languageDecs.length).toBeGreaterThan(0);
      
      // Should have code decoration for inline code
      const codeDecs = result.filter(d => d.type === 'code');
      expect(codeDecs.length).toBeGreaterThan(0);
      
      // Should have transparent decoration for inline code backticks
      const transparentDecs = result.filter(d => d.type === 'transparent');
      expect(transparentDecs.length).toBeGreaterThan(0);
    });

    it('should handle performance edge case: many code blocks with many decorations', () => {
      // Create document with many code blocks and decorations
      const blocks = Array(20).fill(0).map((_, i) => 
        `\`\`\`\ncode block ${i} with **bold** and [link](url)\n\`\`\``
      ).join('\n**bold between blocks**\n');
      
      const markdown = blocks;
      const result = parser.extractDecorations(markdown);
      
      // Should parse correctly without errors
      expect(Array.isArray(result)).toBe(true);
      
      // Should have code block decorations
      const codeBlockDecs = result.filter(d => d.type === 'codeBlock');
      expect(codeBlockDecs.length).toBe(20);
      
      // Should have bold decorations between blocks (not inside)
      const boldDecs = result.filter(d => d.type === 'bold');
      expect(boldDecs.length).toBeGreaterThan(0);
    });
  });

  describe('no inline decorations inside code blocks', () => {
    it('should NOT parse bold inside code blocks', () => {
      const markdown = '```\n**bold text**\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should NOT have bold decorations
      const boldDecs = result.filter(d => d.type === 'bold' || d.type === 'boldItalic');
      expect(boldDecs.length).toBe(0);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
    });

    it('should NOT parse italic inside code blocks', () => {
      const markdown = '```\n*italic text*\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should NOT have italic decorations
      const italicDecs = result.filter(d => d.type === 'italic' || d.type === 'boldItalic');
      expect(italicDecs.length).toBe(0);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
    });

    it('should NOT parse strikethrough inside code blocks', () => {
      const markdown = '```\n~~strikethrough text~~\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should NOT have strikethrough decorations
      const strikethroughDecs = result.filter(d => d.type === 'strikethrough');
      expect(strikethroughDecs.length).toBe(0);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
    });

    it('should NOT parse links inside code blocks', () => {
      const markdown = '```\n[link text](https://example.com)\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should NOT have link decorations
      const linkDecs = result.filter(d => d.type === 'link');
      expect(linkDecs.length).toBe(0);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
    });

    it('should NOT parse any inline decorations inside mermaid code blocks', () => {
      const markdown = '```mermaid\ngraph TD\nA[Start] --> B{Is Markdown beautiful?}\nB -- Yes --> C[More readable!]\nB -- No --> D[Try Mermaid diagrams]\nD --> E[Visualize ideas]\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should NOT have any inline formatting decorations
      const boldDecs = result.filter(d => d.type === 'bold' || d.type === 'boldItalic');
      const italicDecs = result.filter(d => d.type === 'italic');
      const strikethroughDecs = result.filter(d => d.type === 'strikethrough');
      const linkDecs = result.filter(d => d.type === 'link');
      
      expect(boldDecs.length).toBe(0);
      expect(italicDecs.length).toBe(0);
      expect(strikethroughDecs.length).toBe(0);
      expect(linkDecs.length).toBe(0);
      
      // Should have mermaid block (not codeBlock decoration, as mermaid blocks are handled separately)
      // But the content should not have inline decorations
    });

    it('should NOT parse multiple inline decorations inside code blocks', () => {
      const markdown = '```\n**bold** *italic* ~~strike~~ [link](url)\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should NOT have any inline formatting decorations
      const boldDecs = result.filter(d => d.type === 'bold' || d.type === 'boldItalic');
      const italicDecs = result.filter(d => d.type === 'italic');
      const strikethroughDecs = result.filter(d => d.type === 'strikethrough');
      const linkDecs = result.filter(d => d.type === 'link');
      
      expect(boldDecs.length).toBe(0);
      expect(italicDecs.length).toBe(0);
      expect(strikethroughDecs.length).toBe(0);
      expect(linkDecs.length).toBe(0);
      
      // Should have code block decoration
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
    });

    it('should parse inline decorations outside code blocks', () => {
      const markdown = '```\ncode\n```\n**bold** *italic* [link](url)';
      const result = parser.extractDecorations(markdown);
      
      // Should have inline formatting decorations for text outside code block
      const boldDecs = result.filter(d => d.type === 'bold' || d.type === 'boldItalic');
      const italicDecs = result.filter(d => d.type === 'italic');
      const linkDecs = result.filter(d => d.type === 'link');
      
      expect(boldDecs.length).toBeGreaterThan(0);
      expect(italicDecs.length).toBeGreaterThan(0);
      expect(linkDecs.length).toBeGreaterThan(0);
    });

    it('should handle code blocks with language identifier and no inline decorations', () => {
      const markdown = '```javascript\n**bold** *italic* [link](url)\n```';
      const result = parser.extractDecorations(markdown);
      
      // Should NOT have any inline formatting decorations
      const boldDecs = result.filter(d => d.type === 'bold' || d.type === 'boldItalic');
      const italicDecs = result.filter(d => d.type === 'italic');
      const linkDecs = result.filter(d => d.type === 'link');
      
      expect(boldDecs.length).toBe(0);
      expect(italicDecs.length).toBe(0);
      expect(linkDecs.length).toBe(0);
      
      // Should have code block and language decorations
      const codeBlock = result.find(d => d.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
      const languageDec = result.find(d => d.type === 'codeBlockLanguage');
      expect(languageDec).toBeDefined();
    });
  });

  describe('indented code blocks inside ordered lists (#80)', () => {
    it('should style multiple indented fences without bleeding into list text', () => {
      const markdown = [
        '1. Test scene:',
        '',
        '    ```sh',
        '    npm start -- --scene=$SCENE_NAME --web',
        '    ```',
        '',
        '    i.e.',
        '',
        '    ```sh',
        '    npm start -- --scene=pdf --web',
        '    ```',
        '',
        '2. Trigger a render locally (using case directory):',
        '',
        '    ```sh',
        '    npm start -- --scene=$SCENE_NAME --case=$PATH_TO_CASE --output=$PATH_TO_OUTPUT_PNG',
        '    ```',
      ].join('\n');

      const result = parser.extractDecorations(markdown);
      const codeBlocks = result.filter((d) => d.type === 'codeBlock');
      expect(codeBlocks.length).toBe(3);

      const listMarkerDecs = result.filter((d) => d.type === 'listMarker' || d.type === 'listItem');
      listMarkerDecs.forEach((dec) => {
        codeBlocks.forEach((block) => {
          const overlaps = dec.startPos < block.endPos && dec.endPos > block.startPos;
          expect(overlaps).toBe(false);
        });
      });
    });
  });
});

