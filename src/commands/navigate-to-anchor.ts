import * as vscode from 'vscode';
import { normalizeAnchorText } from '../position-mapping';

/**
 * Jumps the editor to the heading that matches a markdown fragment.
 *
 * @param anchor - Slug, heading text, or a command-URI args array
 * @param documentUri - File URI string; omitted when `anchor` is the args array
 */
async function navigateToAnchor(
  anchor: string | unknown[],
  documentUri?: string
): Promise<void> {
  // DocumentLink command URIs may pass the JSON array as a single argument
  if (Array.isArray(anchor)) {
    const [parsedAnchor, parsedUri] = anchor;
    anchor = String(parsedAnchor ?? '');
    documentUri = typeof parsedUri === 'string' ? parsedUri : documentUri;
  }

  if (typeof documentUri !== 'string' || documentUri.length === 0) {
    void vscode.window.showInformationMessage(`Anchor "${String(anchor)}" not found`);
    return;
  }

  const uri = vscode.Uri.parse(documentUri);
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);
  const text = document.getText();
  // Split CRLF/CR/LF so Windows files still expose heading text (`.` cannot match `\r`)
  const lines = text.split(/\r\n|\n|\r/);
  const wanted = normalizeAnchorText(String(anchor ?? ''));

  for (let i = 0; i < lines.length; i++) {
    // Optional indent, ATX markers, optional closing hashes, stray CR
    const headingMatch = lines[i].match(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+\s*)?\s*$/);
    if (!headingMatch) {
      continue;
    }

    const headingText = headingMatch[1].trim();
    if (normalizeAnchorText(headingText) !== wanted && headingText.toLowerCase() !== wanted) {
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
