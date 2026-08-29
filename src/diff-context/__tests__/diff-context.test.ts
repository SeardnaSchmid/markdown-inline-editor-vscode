import { TextDocument, TextEditor, Uri, workspace } from '../../test/__mocks__/vscode';
import { isDiffLikeUri, isDiffViewVisible, isEditorInDiffView, shouldSkipInDiffView } from '../../diff-context';

const mockGetConfiguration = vi.fn().mockReturnValue({
  get: vi.fn().mockReturnValue(false),
});

(workspace as any).getConfiguration = mockGetConfiguration;

describe('diff-context', () => {
  describe('isDiffLikeUri', () => {
    it('detects diff schemes', () => {
      expect(isDiffLikeUri(Uri.parse('git:/path/to/file.md') as any)).toBe(true);
      expect(isDiffLikeUri(Uri.parse('vscode-merge:/path/to/file.md') as any)).toBe(true);
      expect(isDiffLikeUri(Uri.parse('vscode-diff:/path/to/file.md') as any)).toBe(true);
    });

    it('does not flag normal file URIs', () => {
      expect(isDiffLikeUri(Uri.file('/path/to/file.md') as any)).toBe(false);
    });

    it('detects "diff" in URI path string', () => {
      expect(isDiffLikeUri(Uri.parse('file:///path/to/diff-view.md') as any)).toBe(true);
    });

    it('detects "merge" in URI path string', () => {
      expect(isDiffLikeUri(Uri.parse('file:///path/to/merge-result.md') as any)).toBe(true);
    });

    it('detects "compare" in URI path string', () => {
      expect(isDiffLikeUri(Uri.parse('file:///compare/files.md') as any)).toBe(true);
    });

    it('detects diff-like query parameters', () => {
      const uri = {
        scheme: 'file',
        query: 'path=/tmp/file.md&mode=compare',
        fragment: '',
        toString: () => 'file:///tmp/file.md?path=/tmp/file.md&mode=compare',
      };

      expect(isDiffLikeUri(uri as any)).toBe(true);
    });

    it('detects diff-like fragments', () => {
      const uri = {
        scheme: 'file',
        query: '',
        fragment: 'merge-view',
        toString: () => 'file:///tmp/file.md#merge-view',
      };

      expect(isDiffLikeUri(uri as any)).toBe(true);
    });
  });

  describe('isDiffViewVisible', () => {
    it('returns true when at least one editor has a diff-like URI', () => {
      const editors = [
        new TextEditor(new TextDocument(Uri.parse('git:/file.md'), 'markdown', 1, ''), []),
      ];
      expect(isDiffViewVisible(editors as any)).toBe(true);
    });

    it('returns false when no editors have diff-like URIs', () => {
      const editors = [
        new TextEditor(new TextDocument(Uri.file('/normal.md'), 'markdown', 1, ''), []),
      ];
      expect(isDiffViewVisible(editors as any)).toBe(false);
    });

    it('returns false for empty editors array', () => {
      expect(isDiffViewVisible([])).toBe(false);
    });
  });

  describe('isEditorInDiffView', () => {
    it('returns true if the editor document has a diff-like URI', () => {
      const diffEditor = new TextEditor(new TextDocument(Uri.parse('git:/file.md'), 'markdown', 1, ''), []);
      expect(isEditorInDiffView(diffEditor as any, [diffEditor as any])).toBe(true);
    });

    it('returns true if another visible editor in the SAME viewColumn has a diff-like URI (side-by-side diff)', () => {
      const leftDiff = new TextEditor(new TextDocument(Uri.parse('git:/file.md'), 'markdown', 1, ''), []);
      (leftDiff as any).viewColumn = 1;
      const rightWorking = new TextEditor(new TextDocument(Uri.file('/file.md'), 'markdown', 1, ''), []);
      (rightWorking as any).viewColumn = 1;

      expect(isEditorInDiffView(rightWorking as any, [leftDiff as any, rightWorking as any])).toBe(true);
    });

    it('returns false for normal file when diff editor is in a DIFFERENT viewColumn (split pane)', () => {
      const diffEditor = new TextEditor(new TextDocument(Uri.parse('git:/file.md'), 'markdown', 1, ''), []);
      (diffEditor as any).viewColumn = 1;
      const normalMarkdown = new TextEditor(new TextDocument(Uri.file('/README.md'), 'markdown', 1, ''), []);
      (normalMarkdown as any).viewColumn = 2;

      expect(isEditorInDiffView(normalMarkdown as any, [diffEditor as any, normalMarkdown as any])).toBe(false);
    });

    it('returns false when no editors have diff-like URIs', () => {
      const normalEditor = new TextEditor(new TextDocument(Uri.file('/README.md'), 'markdown', 1, ''), []);
      (normalEditor as any).viewColumn = 1;

      expect(isEditorInDiffView(normalEditor as any, [normalEditor as any])).toBe(false);
    });
  });

  describe('shouldSkipInDiffView', () => {
    it('returns false for regular file documents', () => {
      const document = new TextDocument(Uri.file('/path/to/file.md'), 'markdown', 1, 'text');
      mockGetConfiguration.mockReturnValue({
        get: vi.fn().mockReturnValue(false),
      });

      expect(shouldSkipInDiffView(document as any)).toBe(false);
    });

    it('returns true for diff schemes when decorations disabled', () => {
      const document = new TextDocument(Uri.parse('git:/path/to/file.md'), 'markdown', 1, 'text');
      mockGetConfiguration.mockReturnValue({
        get: vi.fn().mockReturnValue(false),
      });

      expect(shouldSkipInDiffView(document as any)).toBe(true);
    });

    it('returns false for diff schemes when decorations enabled', () => {
      const document = new TextDocument(Uri.parse('git:/path/to/file.md'), 'markdown', 1, 'text');
      mockGetConfiguration.mockReturnValue({
        get: vi.fn().mockReturnValue(true),
      });

      expect(shouldSkipInDiffView(document as any)).toBe(false);
    });
  });
});
