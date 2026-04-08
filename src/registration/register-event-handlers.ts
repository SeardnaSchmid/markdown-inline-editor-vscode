import * as vscode from 'vscode';
import { config } from '../config';
import { Decorator } from '../decorator';
import { LinkClickHandler } from '../link-click-handler';

export function registerEventHandlers(
  decorator: Decorator,
  linkClickHandler: LinkClickHandler
): vscode.Disposable[] {
  return [
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      decorator.setActiveEditor(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      decorator.updateDecorationsForSelection(event.kind);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        decorator.updateDecorationsFromChange(event);
      }
    }),
    vscode.workspace.onDidRenameFiles((event) => {
      for (const { oldUri, newUri } of event.files) {
        decorator.renameFile(oldUri.toString(), newUri.toString());
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('markdownInlineEditor.defaultBehaviors.diffView.applyDecorations')) {
        const diffViewApplyDecorations = config.diffView.applyDecorations();
        decorator.updateDiffViewDecorationSetting(!diffViewApplyDecorations);
        decorator.updateDecorationsForSelection();
      }

      if (event.affectsConfiguration('markdownInlineEditor.decorations.ghostFaintOpacity')) {
        decorator.recreateGhostFaintDecorationType();
      }

      if (event.affectsConfiguration('markdownInlineEditor.decorations.frontmatterDelimiterOpacity')) {
        decorator.recreateFrontmatterDelimiterDecorationType();
      }

      if (event.affectsConfiguration('markdownInlineEditor.decorations.codeBlockLanguageOpacity')) {
        decorator.recreateCodeBlockLanguageDecorationType();
      }

      if (event.affectsConfiguration('markdownInlineEditor.links.singleClickOpen')) {
        linkClickHandler.setEnabled(config.links.singleClickOpen());
      }

      if (event.affectsConfiguration('markdownInlineEditor.colors')) {
        decorator.recreateColorDependentTypes();
      }

      if (event.affectsConfiguration('editor.fontSize') || event.affectsConfiguration('editor.lineHeight')) {
        decorator.clearMathDecorationCache();
      }
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      decorator.recreateColorDependentTypes();
    }),
  ];
}
