import { MarkdownParser } from '../../parser';
import { createCRLFText } from './helpers/crlf-helpers';

describe('MarkdownParser - YAML Frontmatter', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('basic frontmatter detection', () => {
    it('should detect basic frontmatter with opening and closing delimiters', () => {
      const markdown = `---
title: My Document
---`;
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      
      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      expect(frontmatterDec).toBeDefined();
      if (frontmatterDec) {
        expect(frontmatterDec.startPos).toBe(0);
        expect(frontmatterDec.endPos).toBe(markdown.length);
      }
    });

    it('should detect frontmatter with multiple fields', () => {
      const markdown = `---
title: Document
author: Author
date: 2024-01-01
---`;
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      
      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      expect(frontmatterDec).toBeDefined();
      if (frontmatterDec) {
        expect(frontmatterDec.startPos).toBe(0);
        expect(frontmatterDec.endPos).toBe(markdown.length);
      }
    });

    it('should detect frontmatter at document start with leading whitespace', () => {
      const markdown = `   ---
title: Document
---`;
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      
      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      expect(frontmatterDec).toBeDefined();
      if (frontmatterDec) {
        // Should start from the --- (after whitespace)
        expect(frontmatterDec.startPos).toBe(3);
        expect(frontmatterDec.endPos).toBe(markdown.length);
      }
    });

    it('should not treat frontmatter with leading newlines as frontmatter', () => {
      const markdown = `\n\n---
title: Document
---`;
      const result = parser.extractDecorations(markdown);

      // Frontmatter must be at document start (only spaces/tabs allowed before it)
      // Leading newlines mean it's not at the start, so it shouldn't be treated as frontmatter
      expect(result.some(d => d.type === 'frontmatter')).toBe(false);
    });

    it('should detect empty frontmatter', () => {
      const markdown = `---
---`;
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      
      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      expect(frontmatterDec).toBeDefined();
      if (frontmatterDec) {
        expect(frontmatterDec.startPos).toBe(0);
        expect(frontmatterDec.endPos).toBe(markdown.length);
      }
    });

    it('should detect frontmatter with only whitespace', () => {
      const markdown = `---
   
---`;
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      
      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      expect(frontmatterDec).toBeDefined();
      if (frontmatterDec) {
        expect(frontmatterDec.startPos).toBe(0);
        expect(frontmatterDec.endPos).toBe(markdown.length);
      }
    });
  });

  describe('frontmatter edge cases', () => {
    it('should not treat --- in middle of document as frontmatter', () => {
      const markdown = `# Heading
---
This is a horizontal rule
---`;
      const result = parser.extractDecorations(markdown);

      // Should not have frontmatter decoration
      expect(result.some(d => d.type === 'frontmatter')).toBe(false);
      
      // Should have horizontal rule decorations instead
      expect(result.some(d => d.type === 'horizontalRule')).toBe(true);
    });

    it('should not treat --- after newline and content as frontmatter', () => {
      const markdown = `# Heading
---
title: Document
---`;
      const result = parser.extractDecorations(markdown);

      // Should not have frontmatter decoration (--- is after content, not at start)
      expect(result.some(d => d.type === 'frontmatter')).toBe(false);
    });

    it('should not treat invalid closing delimiter format as frontmatter', () => {
      const markdown = `---
title: Document
--- some text`;
      const result = parser.extractDecorations(markdown);

      // Should not have frontmatter decoration (closing delimiter has extra text)
      expect(result.some(d => d.type === 'frontmatter')).toBe(false);
    });

    it('should not treat ---comment as closing delimiter', () => {
      const markdown = `---
title: Document
---comment`;
      const result = parser.extractDecorations(markdown);

      // Should not have frontmatter decoration (closing delimiter has text after ---)
      expect(result.some(d => d.type === 'frontmatter')).toBe(false);
    });

    // Note: The tests above verify that extra text on the CLOSING delimiter is correctly rejected.
    // Symmetrically, the OPENING delimiter must also strictly reject extra text (e.g. `--- some text` or `---comment`).
    // Per the YAML frontmatter standard (Jekyll, Hugo, GitHub), the opening delimiter line must contain only `---`.
    it('should not treat invalid opening delimiter format as frontmatter', () => {
      const markdown = `--- some text
title: Document
---`;
      const result = parser.extractDecorations(markdown);

      // Should not have frontmatter decoration (opening delimiter has extra text)
      expect(result.some(d => d.type === 'frontmatter')).toBe(false);
    });

    it('should not treat ---comment as opening delimiter', () => {
      const markdown = `---comment
title: Document
---`;
      const result = parser.extractDecorations(markdown);

      // Should not have frontmatter decoration (opening delimiter has text after ---)
      expect(result.some(d => d.type === 'frontmatter')).toBe(false);
    });

    it('should not apply decoration for incomplete frontmatter (no closing delimiter)', () => {
      const markdown = `---
title: Document
# Content starts here`;
      const result = parser.extractDecorations(markdown);

      // Should not have frontmatter decoration
      expect(result.some(d => d.type === 'frontmatter')).toBe(false);
    });

    it('should handle frontmatter followed by content', () => {
      const markdown = `---
title: Document
---
# Content starts here`;
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      
      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      expect(frontmatterDec).toBeDefined();
      if (frontmatterDec) {
        // Should only cover the frontmatter block, not the content
        expect(frontmatterDec.endPos).toBeLessThan(markdown.length);
        // Should end at the closing --- (not including the newline after it)
        expect(markdown.substring(frontmatterDec.endPos - 3, frontmatterDec.endPos)).toBe('---');
      }
    });

    it('should handle frontmatter followed by horizontal rule', () => {
      const markdown = `---
title: Document
---
---`;
      const result = parser.extractDecorations(markdown);

      // Should have frontmatter decoration
      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      
      // Should also have horizontal rule decoration for the second ---
      expect(result.some(d => d.type === 'horizontalRule')).toBe(true);
      
      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      const horizontalRuleDec = result.find(d => d.type === 'horizontalRule');
      
      expect(frontmatterDec).toBeDefined();
      expect(horizontalRuleDec).toBeDefined();
      
      if (frontmatterDec && horizontalRuleDec) {
        // Frontmatter should end before horizontal rule starts
        expect(frontmatterDec.endPos).toBeLessThanOrEqual(horizontalRuleDec.startPos);
      }
    });
  });

  describe('position accuracy', () => {
    it('should have correct positions for frontmatter with content', () => {
      const markdown = `---
title: My Document
author: John Doe
---`;
      const result = parser.extractDecorations(markdown);

      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      expect(frontmatterDec).toBeDefined();
      
      if (frontmatterDec) {
        expect(frontmatterDec.startPos).toBeGreaterThanOrEqual(0);
        expect(frontmatterDec.endPos).toBeLessThanOrEqual(markdown.length);
        expect(frontmatterDec.endPos).toBeGreaterThan(frontmatterDec.startPos);
        
        // Verify it starts with ---
        expect(markdown.substring(frontmatterDec.startPos, frontmatterDec.startPos + 3)).toBe('---');
        
        // Verify it ends with --- (check the last 3 characters before the end position)
        // Account for possible newline after closing delimiter
        const endCheckStart = frontmatterDec.endPos >= 3 ? frontmatterDec.endPos - 3 : 0;
        const endCheckEnd = frontmatterDec.endPos;
        const endingText = markdown.substring(endCheckStart, endCheckEnd);
        expect(endingText).toContain('---');
      }
    });

    it('should have valid positions for all decorations when frontmatter is present', () => {
      const markdown = `---
title: Document
---
# Heading with **bold** text`;
      const result = parser.extractDecorations(markdown);

      // All positions should be valid
      result.forEach(dec => {
        expect(dec.startPos).toBeGreaterThanOrEqual(0);
        expect(dec.endPos).toBeLessThanOrEqual(markdown.length);
        expect(dec.endPos).toBeGreaterThan(dec.startPos);
      });
      
      // Positions should be sorted
      for (let i = 1; i < result.length; i++) {
        expect(result[i].startPos).toBeGreaterThanOrEqual(result[i - 1].startPos);
      }
    });
  });

  describe('interaction with other features', () => {
    it('should work with headings after frontmatter', () => {
      const markdown = `---
title: Document
---
# Heading`;
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      expect(result.some(d => d.type === 'heading1')).toBe(true);
    });

    it('should work with bold text in content after frontmatter', () => {
      const markdown = `---
title: Document
---
Content with **bold** text`;
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      expect(result.some(d => d.type === 'bold')).toBe(true);
    });

    it('should not interfere with horizontal rules in content', () => {
      const markdown = `---
title: Document
---
Content above

---
Content below`;
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      
      // Should have horizontal rule decoration for the --- in content
      const horizontalRules = result.filter(d => d.type === 'horizontalRule');
      expect(horizontalRules.length).toBeGreaterThan(0);
    });
  });

  describe('frontmatter with CRLF line endings', () => {
    it('should detect frontmatter with CRLF line endings', () => {
      const markdown = createCRLFText(`---
title: Document
author: Author
---`);
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      
      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      expect(frontmatterDec).toBeDefined();
      if (frontmatterDec) {
        expect(frontmatterDec.startPos).toBeGreaterThanOrEqual(0);
        expect(frontmatterDec.endPos).toBeLessThanOrEqual(markdown.length);
      }
    });

    it('should have correct positions for frontmatter with CRLF', () => {
      const markdown = createCRLFText(`---
title: My Document
---`);
      const result = parser.extractDecorations(markdown);

      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      expect(frontmatterDec).toBeDefined();
      
      if (frontmatterDec) {
        // Verify positions are valid
        expect(frontmatterDec.startPos).toBeGreaterThanOrEqual(0);
        expect(frontmatterDec.endPos).toBeLessThanOrEqual(markdown.length);
        expect(frontmatterDec.endPos).toBeGreaterThan(frontmatterDec.startPos);
      }
    });

    it('should handle frontmatter followed by content with CRLF', () => {
      const markdown = createCRLFText(`---
title: Document
---
# Content starts here`);
      const result = parser.extractDecorations(markdown);

      expect(result.some(d => d.type === 'frontmatter')).toBe(true);
      expect(result.some(d => d.type === 'heading1')).toBe(true);
      
      const frontmatterDec = result.find(d => d.type === 'frontmatter');
      const headingDec = result.find(d => d.type === 'heading1');
      
      expect(frontmatterDec).toBeDefined();
      expect(headingDec).toBeDefined();
      
      if (frontmatterDec && headingDec) {
        // Frontmatter should end before heading starts
        expect(frontmatterDec.endPos).toBeLessThanOrEqual(headingDec.startPos);
      }
    });

    it('should not treat --- after content as frontmatter with CRLF', () => {
      const markdown = createCRLFText(`# Heading
---
This is a horizontal rule`);
      const result = parser.extractDecorations(markdown);

      // Should not have frontmatter decoration
      expect(result.some(d => d.type === 'frontmatter')).toBe(false);
      
      // Should have horizontal rule decoration instead
      expect(result.some(d => d.type === 'horizontalRule')).toBe(true);
    });
  });
});
