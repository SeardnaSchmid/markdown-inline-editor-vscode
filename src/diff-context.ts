import * as vscode from 'vscode';
import { config } from './config';

const DIFF_SCHEMES = new Set(['git', 'vscode-merge', 'vscode-diff']);

/**
 * True when this document URI is the original or modified side of an open
 * {@link vscode.TabInputTextDiff}. Needed because `vscode.diff` often uses plain
 * `file:` documents (not git:/ or vscode-diff:), so URI-scheme heuristics alone miss it.
 */
export function isUriOpenInTextDiffEditor(uri: vscode.Uri): boolean {
  const tabGroups = vscode.window.tabGroups;
  if (!tabGroups?.all?.length) {
    return false;
  }
  const target = uri.toString();
  return tabGroups.all.some((group) =>
    group.tabs.some((tab) => {
      const input = tab.input;
      return (
        input instanceof vscode.TabInputTextDiff &&
        (input.original.toString() === target || input.modified.toString() === target)
      );
    })
  );
}

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

export function isDiffViewVisible(editors: readonly vscode.TextEditor[]): boolean {
  return editors.some(
    (editor) => isDiffLikeUri(editor.document.uri) || isUriOpenInTextDiffEditor(editor.document.uri)
  );
}

export function shouldSkipInDiffView(document: vscode.TextDocument): boolean {
  return (
    !config.diffView.applyDecorations() &&
    (isDiffLikeUri(document.uri) || isUriOpenInTextDiffEditor(document.uri))
  );
}
