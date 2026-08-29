import * as vscode from 'vscode';
import { config } from './config';

const DIFF_SCHEMES = new Set(['git', 'vscode-merge', 'vscode-diff']);

export function isDiffLikeUri(uri: vscode.Uri): boolean {
  if (DIFF_SCHEMES.has(uri.scheme)) {
    return true;
  }

  const uriLower = uri.toString().toLowerCase();
  if (uriLower.includes('diff') || uriLower.includes('merge') || uriLower.includes('compare')) {
    return true;
  }

  if (uri.query) {
    const query = uri.query.toLowerCase();
    if (query.includes('diff') || query.includes('merge') || query.includes('compare') || query.includes('path=')) {
      return true;
    }
  }

  if (uri.fragment) {
    const fragment = uri.fragment.toLowerCase();
    if (fragment.includes('diff') || fragment.includes('merge')) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a specific editor is part of a diff view.
 *
 * An editor is in a diff view if:
 * 1. Its document URI is diff-like (e.g. git:, vscode-diff:), OR
 * 2. It is the original/modified document in an active TabInputTextDiff, OR
 * 3. It shares the same viewColumn with another visible editor that has a diff-like URI
 *    (in VS Code, both sides of a side-by-side diff editor share the same viewColumn).
 *
 * This ensures that when a normal Markdown file is open in a split pane next to a diff,
 * the normal Markdown file still displays decorations correctly.
 */
export function isEditorInDiffView(
  targetEditor: vscode.TextEditor,
  visibleEditors: readonly vscode.TextEditor[] = (vscode.window as any)?.visibleTextEditors ?? [],
): boolean {
  if (isDiffLikeUri(targetEditor.document.uri)) {
    return true;
  }

  const tabGroups = (vscode.window as any)?.tabGroups?.all;
  if (Array.isArray(tabGroups)) {
    const targetUriStr = targetEditor.document.uri.toString();
    for (const group of tabGroups) {
      const activeTab = group?.activeTab;
      const input = activeTab?.input;
      if (input && typeof input === 'object') {
        const originalUri = (input as any).original?.toString?.();
        const modifiedUri = (input as any).modified?.toString?.();
        if (targetUriStr === originalUri || targetUriStr === modifiedUri) {
          return true;
        }
      }
    }
  }

  if (targetEditor.viewColumn !== undefined) {
    return visibleEditors.some(
      (editor) =>
        editor !== targetEditor &&
        editor.viewColumn === targetEditor.viewColumn &&
        isDiffLikeUri(editor.document.uri),
    );
  }

  return false;
}

export function isDiffViewVisible(editors: readonly vscode.TextEditor[]): boolean {
  return editors.some((editor) => isDiffLikeUri(editor.document.uri));
}

export function shouldSkipInDiffView(document: vscode.TextDocument): boolean {
  return !config.diffView.applyDecorations() && isDiffLikeUri(document.uri);
}
