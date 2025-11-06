import * as vscode from "vscode";
import { Decorator } from "./decorator";
import { MarkdownLinkProvider } from "./linkProvider";

export function activate(context: vscode.ExtensionContext) {
  const decorator = new Decorator();
  decorator.setActiveEditor(vscode.window.activeTextEditor);

  // Register document link provider for clickable links
  const linkProvider = new MarkdownLinkProvider();
  const linkProviderDisposable = vscode.languages.registerDocumentLinkProvider(
    { language: "markdown", scheme: "file" },
    linkProvider
  );
  // Also register for md and mdx files
  const linkProviderDisposableMd =
    vscode.languages.registerDocumentLinkProvider(
      { language: "md", scheme: "file" },
      linkProvider
    );
  const linkProviderDisposableMdx =
    vscode.languages.registerDocumentLinkProvider(
      { language: "mdx", scheme: "file" },
      linkProvider
    );

  const changeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(
    () => {
      decorator.setActiveEditor(vscode.window.activeTextEditor);
    }
  );

  const changeTextEditorSelection =
    vscode.window.onDidChangeTextEditorSelection(() => {
      decorator.updateDecorations();
    });

  const changeDocument = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document === vscode.window.activeTextEditor?.document) {
      decorator.updateDecorations();
    }
  });

  // Refresh decorations when editor configuration changes (including zoom level)
  const changeConfiguration = vscode.workspace.onDidChangeConfiguration(() => {
    decorator.updateDecorations();
  });

  // Register toggle command
  const toggleCommand = vscode.commands.registerCommand(
    "mdInline.toggleDecorations",
    () => {
      decorator.toggleDecorations();
    }
  );

  context.subscriptions.push(changeActiveTextEditor);
  context.subscriptions.push(changeTextEditorSelection);
  context.subscriptions.push(changeDocument);
  context.subscriptions.push(changeConfiguration);
  context.subscriptions.push(toggleCommand);
  context.subscriptions.push(linkProviderDisposable);
  context.subscriptions.push(linkProviderDisposableMd);
  context.subscriptions.push(linkProviderDisposableMdx);
}

export function deactivate(context: vscode.ExtensionContext) {
  context.subscriptions.forEach((subscription) => subscription.dispose());
}
