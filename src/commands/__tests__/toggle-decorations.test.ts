import * as vscode from 'vscode';
import { createToggleDecorationsCommand } from '../toggle-decorations';

describe('toggle-decorations command', () => {
  it('registers command and shows resulting state', async () => {
    let handler: (() => void) | undefined;
    (vscode.commands.registerCommand as jest.Mock).mockImplementation((_id, cb) => {
      handler = cb;
      return { dispose: jest.fn() };
    });

    const decorator = {
      toggleDecorations: jest.fn(() => false),
      activeEditor: {
        document: {
          uri: { toString: () => 'file:///test.md' },
        },
      },
    };
    jest.spyOn(vscode.workspace, 'asRelativePath' as any).mockReturnValue('test.md');

    createToggleDecorationsCommand(decorator as any);
    handler?.();

    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'mdInline.toggleDecorations',
      expect.any(Function)
    );
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Markdown decorations disabled for test.md'
    );
  });

  it('falls back to a generic file label without an active editor', () => {
    let handler: (() => void) | undefined;
    (vscode.commands.registerCommand as jest.Mock).mockImplementation((_id, cb) => {
      handler = cb;
      return { dispose: jest.fn() };
    });

    const decorator = {
      toggleDecorations: jest.fn(() => true),
      activeEditor: undefined,
    };

    createToggleDecorationsCommand(decorator as any);
    handler?.();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Markdown decorations enabled for this file'
    );
  });
});
