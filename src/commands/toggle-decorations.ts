import * as vscode from 'vscode';
import { Decorator } from '../decorator';

export function createToggleDecorationsCommand(decorator: Decorator): vscode.Disposable {
  return vscode.commands.registerCommand('mdInline.toggleDecorations', () => {
    const enabled = decorator.toggleDecorations();
    const fileName = decorator.activeEditor
      ? vscode.workspace.asRelativePath(decorator.activeEditor.document.uri)
      : 'this file';
    void vscode.window.showInformationMessage(
      `Markdown decorations ${enabled ? 'enabled' : 'disabled'} for ${fileName}`
    );
  });
}
