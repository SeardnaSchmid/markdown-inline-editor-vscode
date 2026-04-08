import * as vscode from 'vscode';
import { normalizeAnchorText } from '../position-mapping';

async function navigateToAnchor(anchor: string, documentUri: string): Promise<void> {
  const uri = vscode.Uri.parse(documentUri);
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);
  const text = document.getText();
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^#+\s+(.+)$/);
    if (!headingMatch) {
      continue;
    }

    if (normalizeAnchorText(headingMatch[1]) !== anchor) {
      continue;
    }

    const position = new vscode.Position(i, 0);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(position, position);
    return;
  }

  void vscode.window.showInformationMessage(`Anchor "${anchor}" not found`);
}

export function createNavigateToAnchorCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    'markdown-inline-editor.navigateToAnchor',
    navigateToAnchor
  );
}
