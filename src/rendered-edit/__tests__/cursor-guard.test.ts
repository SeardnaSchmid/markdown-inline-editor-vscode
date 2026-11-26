import * as vscode from 'vscode';
import { MarkdownParser } from '../../parser';
import { MarkdownParseCache } from '../../markdown-parse-cache';
import { RenderedEditCursorGuard } from '../cursor-guard';

function makeEditor(text: string, activeOffset: number, anchorOffset = activeOffset) {
  const doc = new (vscode.TextDocument as any)(vscode.Uri.file('/test.md'), 'markdown', 1, text);
  const anchor = doc.positionAt(anchorOffset);
  const active = doc.positionAt(activeOffset);
  const sel = new vscode.Selection(anchor, active);
  return {
    doc,
    editor: new (vscode.TextEditor as any)(doc, [sel]),
  };
}

describe('RenderedEditCursorGuard', () => {
  let parser: MarkdownParser;
  let cache: MarkdownParseCache;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
    cache = new MarkdownParseCache(parser);
  });

  it('jumps completely over hidden bold markers on Left/Right without stopping inside', () => {
    const text = 'a **bc** d';
    const guard = new RenderedEditCursorGuard();
    // Start inside `**bc**` right after `c` (offset 6).
    const { doc, editor } = makeEditor(text, 6);

    // One Right press skips closing `**` and advances one visible space to `d` (offset 9).
    expect(guard.moveCursor(editor, cache, 'right')).toBe(true);
    expect(doc.offsetAt(editor.selections[0].active)).toBe(9);

    // One Left press steps back before `d` (to space at 8).
    expect(guard.moveCursor(editor, cache, 'left')).toBe(true);
    expect(doc.offsetAt(editor.selections[0].active)).toBe(8);
  });

  it('does not overwrite non-empty drag selections in handleSelectionChange', () => {
    const text = '- **bold** item';
    const guard = new RenderedEditCursorGuard();
    const { editor } = makeEditor(text, 3, 12);

    expect(
      guard.handleSelectionChange(editor, cache, vscode.TextEditorSelectionChangeKind.Mouse)
    ).toBe(false);
    expect(editor.selections[0].anchor).toEqual({ line: 0, character: 12 });
    expect(editor.selections[0].active).toEqual({ line: 0, character: 3 });
  });

  it('snaps caret inside table cells and skips separator rows', () => {
    const text = '| A | B |\n|---|---|\n| 1 | 2 |';
    const guard = new RenderedEditCursorGuard();
    const sepOffset = text.indexOf('---');
    const { doc, editor } = makeEditor(text, sepOffset);

    expect(
      guard.handleSelectionChange(editor, cache, vscode.TextEditorSelectionChangeKind.Mouse)
    ).toBe(true);
    const landed = doc.offsetAt(editor.selections[0].active);
    expect(doc.positionAt(landed).line).not.toBe(1);
  });
});
