import { TextDocument, Uri } from '../../test/__mocks__/vscode';
import { isDiffLikeUri } from '../../diff-context';

/**
 * Tests for diff mode detection functionality.
 * 
 * Note: Full Decorator integration tests are limited due to ESM module loading
 * issues in the test runner (similar to decorator-crlf.test.ts). These tests verify the
 * URI scheme detection logic which is the core of diff mode detection.
 * 
 * Manual testing in VS Code is required to verify full integration:
 * - Open a Git diff view with markdown files
 * - Verify raw markdown is shown when diffView.applyDecorations is false
 * - Verify decorations are shown when diffView.applyDecorations is true
 * - Test with vscode-merge and vscode-diff schemes
 */
describe('Decorator - Diff Mode', () => {
  describe('URI scheme detection', () => {
    it('should detect git scheme from URI', () => {
      const gitUri = Uri.parse('git:/path/to/file.md?%7B%22path%22%3A%22file.md%22%7D');
      expect(gitUri.scheme).toBe('git');
    });

    it('should detect vscode-merge scheme from URI', () => {
      const mergeUri = Uri.parse('vscode-merge:/path/to/file.md');
      expect(mergeUri.scheme).toBe('vscode-merge');
    });

    it('should detect vscode-diff scheme from URI', () => {
      const diffUri = Uri.parse('vscode-diff:/path/to/file.md');
      expect(diffUri.scheme).toBe('vscode-diff');
    });

    it('should detect file scheme from URI', () => {
      const fileUri = Uri.file('test.md');
      expect(fileUri.scheme).toBe('file');
    });

    it('should create TextDocument with git scheme', () => {
      const gitDoc = new TextDocument(
        Uri.parse('git:/path/to/file.md'),
        'markdown',
        1,
        '## Heading'
      );
      expect(gitDoc.uri.scheme).toBe('git');
      expect(gitDoc.languageId).toBe('markdown');
    });

    it('should create TextDocument with file scheme', () => {
      const fileDoc = new TextDocument(
        Uri.file('test.md'),
        'markdown',
        1,
        '## Heading'
      );
      expect(fileDoc.uri.scheme).toBe('file');
      expect(fileDoc.languageId).toBe('markdown');
    });
  });

  describe('diff scheme detection logic', () => {
    it('should identify git scheme as diff scheme', () => {
      const gitUri = Uri.parse('git:/path/to/file.md');
      expect(isDiffLikeUri(gitUri as any)).toBe(true);
    });

    it('should identify vscode-merge scheme as diff scheme', () => {
      const mergeUri = Uri.parse('vscode-merge:/path/to/file.md');
      expect(isDiffLikeUri(mergeUri as any)).toBe(true);
    });

    it('should identify vscode-diff scheme as diff scheme', () => {
      const diffUri = Uri.parse('vscode-diff:/path/to/file.md');
      expect(isDiffLikeUri(diffUri as any)).toBe(true);
    });

    it('should not identify file scheme as diff scheme', () => {
      const fileUri = Uri.file('test.md');
      expect(isDiffLikeUri(fileUri as any)).toBe(false);
    });
  });
});
