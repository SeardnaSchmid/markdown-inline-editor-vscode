import type { Mock } from 'vitest';
import { handleCheckboxClick } from '../checkbox-toggle';
import { workspace, WorkspaceEdit, Selection, Position, Uri, TextDocument } from '../../test/__mocks__/vscode';

/** Build a minimal TextEditor-shaped object for checkbox-toggle tests. */
function makeEditor(lineText: string, cursorChar: number) {
  const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, lineText);
  let currentSelection = new Selection(new Position(0, cursorChar), new Position(0, cursorChar));
  return {
    document: doc,
    get selection() { return currentSelection; },
    set selection(s: any) { currentSelection = s; },
  };
}

describe('handleCheckboxClick', () => {
  beforeEach(() => {
    (workspace.applyEdit as Mock).mockClear();
  });

  describe('returns false (no toggle)', () => {
    it('returns false when there is no checkbox on the line', () => {
      const editor = makeEditor('just some text', 5);
      expect(handleCheckboxClick(editor as any)).toBe(false);
      expect(workspace.applyEdit).not.toHaveBeenCalled();
    });

    it('returns false when cursor is outside the checkbox range', () => {
      // "- [ ] task" — checkbox at chars 2-4; cursor at char 8 (inside "task")
      const editor = makeEditor('- [ ] task', 8);
      expect(handleCheckboxClick(editor as any)).toBe(false);
    });

    it('returns false when selection is non-empty (text selected)', () => {
      const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, '- [ ] task');
      // Non-empty selection: anchor ≠ active
      const editor = {
        document: doc,
        selection: new Selection(new Position(0, 2), new Position(0, 5)),
      };
      expect(handleCheckboxClick(editor as any)).toBe(false);
      expect(workspace.applyEdit).not.toHaveBeenCalled();
    });
  });

  describe('toggles unchecked → checked', () => {
    it('toggles [ ] to [x] when cursor is on the opening bracket', () => {
      // "- [ ] task" — checkbox starts at char 2
      const editor = makeEditor('- [ ] task', 2);
      const result = handleCheckboxClick(editor as any);
      expect(result).toBe(true);
      expect(workspace.applyEdit).toHaveBeenCalledTimes(1);
      const edit = (workspace.applyEdit as Mock).mock.calls[0][0] as WorkspaceEdit;
      const edits = edit.getEdits();
      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toBe('x');
    });

    it('toggles [ ] to [x] when cursor is on the space inside brackets', () => {
      // "- [ ] task" — space at char 3
      const editor = makeEditor('- [ ] task', 3);
      const result = handleCheckboxClick(editor as any);
      expect(result).toBe(true);
      const edit = (workspace.applyEdit as Mock).mock.calls[0][0] as WorkspaceEdit;
      expect(edit.getEdits()[0].newText).toBe('x');
    });

    it('toggles [ ] to [x] when cursor is on the closing bracket', () => {
      // "- [ ] task" — closing bracket at char 4
      const editor = makeEditor('- [ ] task', 4);
      const result = handleCheckboxClick(editor as any);
      expect(result).toBe(true);
      const edit = (workspace.applyEdit as Mock).mock.calls[0][0] as WorkspaceEdit;
      expect(edit.getEdits()[0].newText).toBe('x');
    });
  });

  describe('toggles checked → unchecked', () => {
    it('toggles [x] to [ ] (lowercase x)', () => {
      // "- [x] done" — checkbox starts at char 2
      const editor = makeEditor('- [x] done', 3);
      const result = handleCheckboxClick(editor as any);
      expect(result).toBe(true);
      const edit = (workspace.applyEdit as Mock).mock.calls[0][0] as WorkspaceEdit;
      expect(edit.getEdits()[0].newText).toBe(' ');
    });

    it('toggles [X] to [ ] (uppercase X)', () => {
      const editor = makeEditor('- [X] done', 3);
      const result = handleCheckboxClick(editor as any);
      expect(result).toBe(true);
      const edit = (workspace.applyEdit as Mock).mock.calls[0][0] as WorkspaceEdit;
      expect(edit.getEdits()[0].newText).toBe(' ');
    });
  });

  describe('cursor positioning after toggle', () => {
    it('moves cursor past the checkbox bracket after toggling', () => {
      // "- [ ] task" — checkbox `[` at index 2, bracketEnd = 2+3 = 5, cursor set to bracketEnd+1 = 6
      const editor = makeEditor('- [ ] task', 3);
      handleCheckboxClick(editor as any);
      expect(editor.selection.active.character).toBe(6);
      expect(editor.selection.active.line).toBe(0);
    });
  });

  describe('multiple checkboxes on one line', () => {
    it('toggles the correct checkbox when there are two on the same line', () => {
      // "[ ] a [ ] b" — first checkbox at 0, second at 6
      const editor = makeEditor('[ ] a [ ] b', 7); // cursor inside second checkbox
      const result = handleCheckboxClick(editor as any);
      expect(result).toBe(true);
      const edit = (workspace.applyEdit as Mock).mock.calls[0][0] as WorkspaceEdit;
      const edits = edit.getEdits();
      // The replaced range should be inside the second checkbox (char 7)
      expect(edits[0].range.start.character).toBe(7); // bracketStart(6) + 1
      expect(edits[0].newText).toBe('x');
    });
  });
});
