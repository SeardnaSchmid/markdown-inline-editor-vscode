import { TextDocument, Uri } from '../../test/__mocks__/vscode';
import { createCRLFText } from '../../parser/__tests__/helpers/crlf-helpers';

describe('Decorator - CRLF Line Endings', () => {
  // Note: Full decorator tests are limited due to ESM module loading issues in tests.
  // The critical position mapping tests are in decorator-position-mapping.test.ts

  describe('CRLF text handling', () => {
    it('should handle CRLF in mock TextDocument', () => {
      const crlfText = createCRLFText('> Quote text\n> More quote');
      const document = new TextDocument(
        Uri.file('test.md'),
        'markdown',
        1,
        crlfText
      );
      
      // Verify document preserves CRLF
      expect(document.getText()).toBe(crlfText);
      expect(document.getText()).toContain('\r\n');
    });

    it('should handle the exact bug report scenario text', () => {
      const bugReportText = createCRLFText(
        '## To Do\n\n- [ ] Item 1\n- [ ] Item 2\n\n### Bullet points\n\n- Item A\n- Item B'
      );
      const document = new TextDocument(
        Uri.file('test.md'),
        'markdown',
        1,
        bugReportText
      );
      
      // Verify document preserves CRLF
      expect(document.getText()).toBe(bugReportText);
      expect(document.getText()).toContain('\r\n');
    });
  });

  describe('positionAt with CRLF', () => {
    it('should correctly calculate positions with CRLF using mock positionAt', () => {
      const crlfText = createCRLFText('Line 1\nLine 2');
      const document = new TextDocument(
        Uri.file('test.md'),
        'markdown',
        1,
        crlfText
      );
      
      // Test that positionAt handles CRLF correctly
      const pos1 = document.positionAt(0);
      expect(pos1.line).toBe(0);
      expect(pos1.character).toBe(0);
      
      // Position at end of first line (after "Line 1" and before \r\n)
      const pos2 = document.positionAt(6);
      expect(pos2.line).toBe(0);
      expect(pos2.character).toBe(6);
      
      // Position after CRLF (should be on line 1)
      const pos3 = document.positionAt(8); // After \r\n
      expect(pos3.line).toBe(1);
      expect(pos3.character).toBe(0);
    });
  });
});

