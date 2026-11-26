import * as vscode from 'vscode';
import { MarkdownParser } from '../../parser';
import { filterRenderedEditDecorations } from '../applier';

describe('rendered-edit applier', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  it('keeps inline markers and headings rendered even when the cursor is inside them', () => {
    const text = '# **Title**';
    const doc = new (vscode.TextDocument as any)(vscode.Uri.file('/test.md'), 'markdown', 1, text);
    const pos = doc.positionAt(5); // inside Title
    const editor = new (vscode.TextEditor as any)(doc, [new vscode.Selection(pos, pos)]);

    const { decorations } = parser.extractDecorationsWithScopes(text);
    const filtered = filterRenderedEditDecorations(
      editor,
      decorations,
      text,
      (startPos, endPos) => new vscode.Range(doc.positionAt(startPos), doc.positionAt(endPos))
    );

    expect(filtered.get('hide')?.length).toBeGreaterThanOrEqual(3);
    expect(filtered.get('heading1')).toHaveLength(1);
    expect(filtered.get('bold')).toHaveLength(1);
  });

  it('keeps table decorations active when the cursor is inside a table cell', () => {
    const text = '| Name | Age |\n|------|-----|\n| Ada  | 36  |';
    const doc = new (vscode.TextDocument as any)(vscode.Uri.file('/test.md'), 'markdown', 1, text);
    const pos = doc.positionAt(text.indexOf('Ada'));
    const editor = new (vscode.TextEditor as any)(doc, [new vscode.Selection(pos, pos)]);

    const { decorations } = parser.extractDecorationsWithScopes(text);
    const filtered = filterRenderedEditDecorations(
      editor,
      decorations,
      text,
      (startPos, endPos) => new vscode.Range(doc.positionAt(startPos), doc.positionAt(endPos))
    );

    expect(filtered.get('tableCell')?.length).toBeGreaterThanOrEqual(4);
    expect(filtered.get('tablePipe')?.length).toBeGreaterThanOrEqual(6);
  });
});
