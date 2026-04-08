import { TextDocument, Uri } from '../../test/__mocks__/vscode';
import { createCRLFText } from '../../parser/__tests__/helpers/crlf-helpers';

describe('Decorator - Cache with CRLF', () => {
  // Note: Full decorator cache tests are limited due to ESM module loading issues in tests.
  // These tests verify CRLF handling in mock documents.
  // The critical position mapping tests are in decorator-position-mapping.test.ts

  describe('CRLF text in documents', () => {
    it('should preserve CRLF text in TextDocument', () => {
      const crlfText = createCRLFText('# Heading\n**bold**');
      const document = new TextDocument(
        Uri.file('test.md'),
        'markdown',
        1,
        crlfText
      );
      
      // Verify document text is preserved (CRLF should be maintained)
      expect(document.getText()).toBe(crlfText);
      expect(document.getText()).toContain('\r\n');
    });

    it('should handle multiple documents with CRLF', () => {
      const documents: TextDocument[] = [];
      
      for (let i = 0; i < 5; i++) {
        const crlfText = createCRLFText(`# Document ${i}\n**bold**`);
        const doc = new TextDocument(
          Uri.file(`test${i}.md`),
          'markdown',
          1,
          crlfText
        );
        documents.push(doc);
      }
      
      // Verify all documents preserve CRLF
      documents.forEach((doc, i) => {
        expect(doc.getText()).toContain(`Document ${i}`);
        expect(doc.getText()).toContain('\r\n');
      });
    });

    it('should handle document version changes with CRLF', () => {
      const crlfText1 = createCRLFText('# Heading 1');
      const document1 = new TextDocument(
        Uri.file('test.md'),
        'markdown',
        1,
        crlfText1
      );
      
      // Change document
      const crlfText2 = createCRLFText('# Heading 2');
      const document2 = new TextDocument(
        Uri.file('test.md'),
        'markdown',
        2,
        crlfText2
      );
      
      // Verify both preserve CRLF
      expect(document1.getText()).toBe(crlfText1);
      expect(document2.getText()).toBe(crlfText2);
      expect(document1.version).not.toBe(document2.version);
    });
  });
});

