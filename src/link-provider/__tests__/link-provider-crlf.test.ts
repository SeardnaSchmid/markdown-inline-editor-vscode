import { MarkdownParser } from '../../parser';
import { workspace } from '../../test/__mocks__/vscode';
import { createCRLFText, mapNormalizedToOriginal } from '../../parser/__tests__/helpers/crlf-helpers';

// Mock workspace.getConfiguration
const mockGetConfiguration = vi.fn().mockReturnValue({
  get: vi.fn().mockReturnValue(false), // defaultBehaviors.diffView.applyDecorations defaults to false
});

(workspace as any).getConfiguration = mockGetConfiguration;

/**
 * Test the position mapping logic used by MarkdownLinkProvider.
 * 
 * Note: We can't directly test MarkdownLinkProvider in unit tests due to ESM module loading issues
 * with the parser. However, we can test the core position mapping logic that was added
 * to fix issue #33 (CRLF line endings in table of contents links).
 * 
 * The fix adds mapNormalizedToOriginal() to MarkdownLinkProvider, which uses the same
 * logic as the helper function we're testing here.
 */
describe('MarkdownLinkProvider - CRLF Line Endings (Position Mapping)', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  describe('Table of Contents links with CRLF', () => {
    it('should correctly map link positions in table of contents with CRLF line endings', async () => {
      // This is the exact scenario from issue #33
      const markdownWithCRLF = createCRLFText(`# Test 123

## Table of Contents

- [Markdown Example with Mermaid Diagrams](#markdown-example-with-mermaid-diagrams)
- [Test 123](#test-123)
  - [Table of Contents](#table-of-contents)
- [Heading 1](#heading-1)
  - [Heading 2](#heading-2)
    - [Heading 3](#heading-3)
      - [Heading 4](#heading-4)
        - [Heading 5](#heading-5)

## Markdown Example with Mermaid Diagrams

### Heading 1

#### Heading 2

##### Heading 3

###### Heading 4

####### Heading 5
`);

      // Parse the markdown to get decorations
      const decorations = parser.extractDecorations(markdownWithCRLF);
      
      // Find link decorations
      const linkDecorations = decorations.filter(d => d.type === 'link' && d.url);
      expect(linkDecorations.length).toBeGreaterThan(0);

      // Verify that position mapping works correctly for links
      // The parser returns positions in normalized (LF) text, but we need to map them
      // to original (CRLF) positions for VS Code's positionAt()
      for (const linkDec of linkDecorations) {
        // Map normalized positions to original positions
        const mappedStart = mapNormalizedToOriginal(linkDec.startPos, markdownWithCRLF);
        const mappedEnd = mapNormalizedToOriginal(linkDec.endPos, markdownWithCRLF);
        
        // Verify the mapped positions are valid
        expect(mappedStart).toBeGreaterThanOrEqual(0);
        expect(mappedEnd).toBeGreaterThan(mappedStart);
        expect(mappedEnd).toBeLessThanOrEqual(markdownWithCRLF.length);
        
        // Verify the text at the mapped positions matches the link text
        const linkText = markdownWithCRLF.substring(mappedStart, mappedEnd);
        expect(linkText.length).toBeGreaterThan(0);
      }
    });

    it('should correctly map nested table of contents link positions with CRLF', async () => {
      const markdownWithCRLF = createCRLFText(`# Main Heading

## Table of Contents

- [Main Heading](#main-heading)
  - [Subsection 1](#subsection-1)
    - [Subsection 1.1](#subsection-11)
  - [Subsection 2](#subsection-2)

## Subsection 1

### Subsection 1.1

## Subsection 2
`);

      const decorations = parser.extractDecorations(markdownWithCRLF);
      const linkDecorations = decorations.filter(d => d.type === 'link' && d.url);
      
      expect(linkDecorations.length).toBeGreaterThan(0);

      // Find the nested link
      const nestedLinkDec = linkDecorations.find(dec => {
        const mappedStart = mapNormalizedToOriginal(dec.startPos, markdownWithCRLF);
        const mappedEnd = mapNormalizedToOriginal(dec.endPos, markdownWithCRLF);
        const linkText = markdownWithCRLF.substring(mappedStart, mappedEnd);
        return linkText.includes('Subsection 1.1');
      });

      expect(nestedLinkDec).toBeDefined();
      if (nestedLinkDec) {
        const mappedStart = mapNormalizedToOriginal(nestedLinkDec.startPos, markdownWithCRLF);
        const mappedEnd = mapNormalizedToOriginal(nestedLinkDec.endPos, markdownWithCRLF);
        const linkText = markdownWithCRLF.substring(mappedStart, mappedEnd);
        expect(linkText).toBe('Subsection 1.1');
      }
    });

    it('should correctly map anchor link positions with CRLF', async () => {
      const markdownWithCRLF = createCRLFText(`# Heading 1

[Link to Heading 1](#heading-1)

## Heading 1
`);

      const decorations = parser.extractDecorations(markdownWithCRLF);
      const linkDecorations = decorations.filter(d => d.type === 'link' && d.url && d.url.startsWith('#'));
      
      expect(linkDecorations.length).toBeGreaterThan(0);

      // Find the anchor link
      const anchorLinkDec = linkDecorations.find(dec => dec.url === '#heading-1');
      expect(anchorLinkDec).toBeDefined();
      
      if (anchorLinkDec) {
        // Map positions and verify the link text
        const mappedStart = mapNormalizedToOriginal(anchorLinkDec.startPos, markdownWithCRLF);
        const mappedEnd = mapNormalizedToOriginal(anchorLinkDec.endPos, markdownWithCRLF);
        const linkText = markdownWithCRLF.substring(mappedStart, mappedEnd);
        expect(linkText).toBe('Link to Heading 1');
      }
    });
  });

  describe('Position mapping with CRLF', () => {
    it('should correctly map normalized positions to original CRLF positions', async () => {
      // Simple test case: link in middle of document with CRLF
      const markdownWithCRLF = createCRLFText(`Line 1

[Link Text](#anchor)

Line 2
`);

      const decorations = parser.extractDecorations(markdownWithCRLF);
      const linkDecorations = decorations.filter(d => d.type === 'link' && d.url);
      
      expect(linkDecorations.length).toBe(1);

      const linkDec = linkDecorations[0];
      
      // Map normalized positions to original positions
      const mappedStart = mapNormalizedToOriginal(linkDec.startPos, markdownWithCRLF);
      const mappedEnd = mapNormalizedToOriginal(linkDec.endPos, markdownWithCRLF);
      
      // Verify the link text is correctly extracted using mapped positions
      const linkText = markdownWithCRLF.substring(mappedStart, mappedEnd);
      expect(linkText).toBe('Link Text');
    });

    it('should handle links at line boundaries with CRLF', async () => {
      const markdownWithCRLF = createCRLFText(`[First Link](#first)

[Second Link](#second)
`);

      const decorations = parser.extractDecorations(markdownWithCRLF);
      const linkDecorations = decorations.filter(d => d.type === 'link' && d.url);
      
      expect(linkDecorations.length).toBe(2);

      // Verify first link
      const firstMappedStart = mapNormalizedToOriginal(linkDecorations[0].startPos, markdownWithCRLF);
      const firstMappedEnd = mapNormalizedToOriginal(linkDecorations[0].endPos, markdownWithCRLF);
      const firstLinkText = markdownWithCRLF.substring(firstMappedStart, firstMappedEnd);
      expect(firstLinkText).toBe('First Link');

      // Verify second link
      const secondMappedStart = mapNormalizedToOriginal(linkDecorations[1].startPos, markdownWithCRLF);
      const secondMappedEnd = mapNormalizedToOriginal(linkDecorations[1].endPos, markdownWithCRLF);
      const secondLinkText = markdownWithCRLF.substring(secondMappedStart, secondMappedEnd);
      expect(secondLinkText).toBe('Second Link');
    });
  });
});
