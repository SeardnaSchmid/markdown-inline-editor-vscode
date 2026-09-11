import type { Mock } from 'vitest';
import { MarkdownParser } from '../../parser';
import { buildCheckboxTargets, handleCheckboxClick } from '../checkbox-toggle';
import { workspace, WorkspaceEdit, Selection, Position, Uri, TextDocument } from '../../test/__mocks__/vscode';

let parser: MarkdownParser;
beforeAll(async () => { parser = await MarkdownParser.create(); });
beforeEach(() => { (workspace.applyEdit as Mock).mockClear(); });

function makeEditor(text: string, line: number, character: number) {
  const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
  let selection = new Selection(new Position(line, character), new Position(line, character));
  return {
    document,
    get selection() { return selection; },
    set selection(value: any) { selection = value; },
  };
}

function toggle(editor: ReturnType<typeof makeEditor>) {
  const result = parser.extractDecorationsWithScopes(editor.document.getText());
  const targets = buildCheckboxTargets(editor as any, {
    version: editor.document.version,
    text: editor.document.getText(),
    ...result,
  });
  return handleCheckboxClick(editor as any, targets);
}

function edit(): WorkspaceEdit {
  return (workspace.applyEdit as Mock).mock.calls[0][0] as WorkspaceEdit;
}

describe('parser-backed checkbox toggling', () => {
  it.each([0, 1, 2, 3, 4, 5])('toggles across the rendered target at column %i', (column) => {
    expect(toggle(makeEditor('- [ ] task', 0, column))).toBe(true);
    expect(edit().getEdits()[0].newText).toBe('x');
  });

  it('toggles checked state and edits only its source character', () => {
    expect(toggle(makeEditor('  - [X] done', 0, 5))).toBe(true);
    expect(edit().getEdits()[0]).toMatchObject({
      newText: ' ',
      range: { start: { line: 0, character: 5 } },
    });
  });

  it('supports parser-recognized blockquote and ordered-list targets', () => {
    expect(toggle(makeEditor('> - [ ] task', 0, 5))).toBe(true);
    expect(toggle(makeEditor('1. [ ] task', 0, 3))).toBe(true);
    expect(toggle(makeEditor('1. [ ] task', 0, 0))).toBe(false);
  });

  it.each([
    ['- [ ]task', 0, 3],
    ['- [ ] some item [ ]', 0, 17],
    ['```md\n- [ ] code\n```', 1, 3],
    ['- `[ ]` code', 0, 3],
    ['text with [ ] brackets', 0, 11],
  ])('does not toggle text the parser rejects: %s', (text, line, character) => {
    expect(toggle(makeEditor(text, line, character))).toBe(false);
  });

  it('does not mistake an indented code fence for an open fenced block', () => {
    expect(toggle(makeEditor('    ```\n- [ ] task', 1, 3))).toBe(true);
  });

  it('rejects selections and does not move the caret itself', () => {
    const editor = makeEditor('- [ ] task', 0, 3);
    editor.selection = new Selection(new Position(0, 2), new Position(0, 5));
    expect(toggle(editor)).toBe(false);
    editor.selection = new Selection(new Position(0, 3), new Position(0, 3));
    expect(toggle(editor)).toBe(true);
    expect(editor.selection.active).toEqual(new Position(0, 3));
  });

  it('maps parser offsets in CRLF documents', () => {
    expect(toggle(makeEditor('first\r\n- [ ] second', 1, 3))).toBe(true);
    expect(edit().getEdits()[0].range.start).toEqual(new Position(1, 3));
  });
});
