import * as vscode from 'vscode';
import { Decorator } from '../decorator';

export function createToggleDecorationsCommand(decorator: Decorator): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand('mdInline.switchToVisual', () => decorator.setMode('visual')),
    vscode.commands.registerCommand('mdInline.switchToHybrid', () => decorator.setMode('hybrid')),
    vscode.commands.registerCommand('mdInline.switchToRaw', () => decorator.setMode('raw'))
  );
}
