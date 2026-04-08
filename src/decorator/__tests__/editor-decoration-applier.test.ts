import * as vscode from 'vscode';
import { config } from '../../config';
import {
  applyFilteredDecorations,
  buildScopeEntries,
  createRange,
  isSelectionOrCursorInsideOffsets,
} from '../editor-decoration-applier';

describe('editor-decoration-applier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates mapped ranges from normalized offsets', () => {
    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      'a\r\nb'
    );
    const editor = new (vscode.TextEditor as any)(document, []);

    const range = createRange(editor, 0, 3, document.getText());

    expect(range).not.toBeNull();
    expect(range?.start).toEqual({ line: 0, character: 0 });
    expect(range?.end).toEqual({ line: 1, character: 1 });
  });

  it('returns null when the document cannot map positions', () => {
    const editor = {
      document: {
        positionAt: vi.fn(() => {
          throw new Error('boom');
        }),
      },
    };

    expect(createRange(editor as any, 0, 1, 'a')).toBeNull();
  });

  it('builds scope entries and skips invalid ranges', () => {
    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      'hello'
    );
    const editor = new (vscode.TextEditor as any)(document, []);
    vi.spyOn(document, 'positionAt')
      .mockImplementationOnce(() => ({ line: 0, character: 0 }))
      .mockImplementationOnce(() => ({ line: 0, character: 5 }))
      .mockImplementationOnce(() => {
        throw new Error('bad range');
      });

    const entries = buildScopeEntries(
      editor as any,
      [
        { startPos: 0, endPos: 5, kind: 'frontmatter' },
        { startPos: 6, endPos: 8, kind: 'code' },
      ],
      document.getText()
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      startPos: 0,
      endPos: 5,
      kind: 'frontmatter',
    });
  });

  it('returns no scope entries without an editor or scopes', () => {
    expect(buildScopeEntries(undefined, [], 'text')).toEqual([]);
  });

  it('detects cursor and selection overlap against mapped offsets', () => {
    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      'abcd'
    );

    const cursor = new vscode.Range(
      new vscode.Position(0, 1),
      new vscode.Position(0, 1)
    );
    const selection = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(0, 2)
    );
    const outside = new vscode.Range(
      new vscode.Position(0, 3),
      new vscode.Position(0, 3)
    );

    expect(
      isSelectionOrCursorInsideOffsets(0, 2, document.getText(), [cursor], document as any)
    ).toBe(true);
    expect(
      isSelectionOrCursorInsideOffsets(0, 2, document.getText(), [selection], document as any)
    ).toBe(true);
    expect(
      isSelectionOrCursorInsideOffsets(0, 2, document.getText(), [outside], document as any)
    ).toBe(false);
  });

  it('applies ranges, render options, ghost faint, and reports non-empty counts', () => {
    vi.spyOn(config.emojis, 'enabled').mockReturnValue(true);

    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      'hello'
    );
    const editor = new (vscode.TextEditor as any)(document, []);
    editor.setDecorations = vi.fn();

    const hideType = { key: 'hide' };
    const emojiType = { key: 'emoji' };
    const tableType = { key: 'tableCell' };
    const ghostFaintType = { key: 'ghostFaint' };
    const registry = {
      getMap: () =>
        new Map<any, any>([
          ['hide', hideType],
          ['emoji', emojiType],
          ['tableCell', tableType],
        ]),
      getGhostFaintDecorationType: () => ghostFaintType,
    };

    const hideRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1));
    const ghostRange = new vscode.Range(new vscode.Position(0, 1), new vscode.Position(0, 2));
    const emojiOption = { range: hideRange, renderOptions: { after: { contentText: 'x' } } };
    const tableOption = { range: hideRange, renderOptions: { before: { contentText: '|' } } };
    const onApply = vi.fn();

    applyFilteredDecorations(
      editor as any,
      new Map<any, any>([
        ['hide', [hideRange]],
        ['emoji', [emojiOption]],
        ['tableCell', [tableOption]],
        ['ghostFaint', [ghostRange]],
      ]),
      registry as any,
      onApply
    );

    expect(editor.setDecorations).toHaveBeenCalledWith(hideType, [hideRange]);
    expect(editor.setDecorations).toHaveBeenCalledWith(emojiType, [emojiOption]);
    expect(editor.setDecorations).toHaveBeenCalledWith(tableType, [tableOption]);
    expect(editor.setDecorations).toHaveBeenCalledWith(ghostFaintType, [ghostRange]);
    expect(onApply).toHaveBeenCalledWith(4);
  });

  it('clears emoji decorations when emojis are disabled', () => {
    vi.spyOn(config.emojis, 'enabled').mockReturnValue(false);

    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      'hello'
    );
    const editor = new (vscode.TextEditor as any)(document, []);
    editor.setDecorations = vi.fn();

    const emojiType = { key: 'emoji' };
    const registry = {
      getMap: () => new Map<any, any>([['emoji', emojiType]]),
      getGhostFaintDecorationType: () => ({ key: 'ghostFaint' }),
    };

    applyFilteredDecorations(editor as any, new Map<any, any>(), registry as any);

    expect(editor.setDecorations).toHaveBeenCalledWith(emojiType, []);
  });
});
