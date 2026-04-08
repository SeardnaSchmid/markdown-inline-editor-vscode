import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { createNavigateToAnchorCommand } from '../navigate-to-anchor';

describe('navigate-to-anchor command', () => {
  it('opens document and selects matching heading', async () => {
    let handler: ((anchor: string, documentUri: string) => Promise<void>) | undefined;
    (vscode.commands.registerCommand as Mock).mockImplementation((_id, cb) => {
      handler = cb;
      return { dispose: vi.fn() };
    });

    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      '# Title\n## My Heading'
    );
    const editor = new (vscode.TextEditor as any)(document, []);
    editor.revealRange = vi.fn();
    (vscode.workspace.openTextDocument as Mock).mockResolvedValue(document);
    (vscode.window.showTextDocument as Mock).mockResolvedValue(editor);

    createNavigateToAnchorCommand();
    await handler?.('my-heading', 'file:///test.md');

    expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
    expect(editor.revealRange).toHaveBeenCalled();
    expect(editor.selection).toBeDefined();
  });

  it('shows message when anchor is missing', async () => {
    let handler: ((anchor: string, documentUri: string) => Promise<void>) | undefined;
    (vscode.commands.registerCommand as Mock).mockImplementation((_id, cb) => {
      handler = cb;
      return { dispose: vi.fn() };
    });

    const document = new (vscode.TextDocument as any)(
      vscode.Uri.file('/test.md'),
      'markdown',
      1,
      '# Title'
    );
    (vscode.workspace.openTextDocument as Mock).mockResolvedValue(document);
    (vscode.window.showTextDocument as Mock).mockResolvedValue(new (vscode.TextEditor as any)(document, []));

    createNavigateToAnchorCommand();
    await handler?.('missing', 'file:///test.md');

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Anchor "missing" not found');
  });
});
