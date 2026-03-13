import * as vscode from 'vscode';

export type LinkTarget =
  | { kind: 'command'; command: string; args: unknown[] }
  | { kind: 'uri'; uri: vscode.Uri };

export function resolveImageTarget(url: string, documentUri: vscode.Uri): vscode.Uri | undefined {
  const trimmed = url.trim();
  if (!trimmed) {
    return;
  }

  if (trimmed.startsWith('/')) {
    return vscode.Uri.file(trimmed);
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:')
  ) {
    try {
      return vscode.Uri.parse(trimmed);
    } catch {
      return;
    }
  }

  return vscode.Uri.joinPath(documentUri, '..', trimmed);
}

export function resolveLinkTarget(url: string, documentUri: vscode.Uri): LinkTarget | undefined {
  const trimmed = url.trim();
  if (!trimmed) {
    return;
  }

  if (trimmed.startsWith('#')) {
    const anchor = trimmed.substring(1);
    return { kind: 'command', command: 'markdown-inline-editor.navigateToAnchor', args: [anchor, documentUri.toString()] };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')) {
    return { kind: 'uri', uri: vscode.Uri.parse(trimmed) };
  }

  if (trimmed.startsWith('file:')) {
    try {
      return { kind: 'uri', uri: vscode.Uri.parse(trimmed) };
    } catch {
      return;
    }
  }

  if (trimmed.startsWith('/')) {
    return { kind: 'uri', uri: vscode.Uri.file(trimmed) };
  }

  return { kind: 'uri', uri: vscode.Uri.joinPath(documentUri, '..', trimmed) };
}

export function toCommandUri(command: string, args: unknown[]): vscode.Uri {
  return vscode.Uri.parse(`command:${command}?${encodeURIComponent(JSON.stringify(args))}`);
}

const GITHUB_BASE = 'https://github.com';

/**
 * Resolves a mention slug (@username or @org/team) to a GitHub profile or team URL.
 *
 * @param slug - The segment after @ (e.g. "alice", "org/team")
 * @returns URI for the GitHub profile or team page, or undefined if invalid
 */
export function resolveMentionTarget(slug: string): vscode.Uri | undefined {
  const trimmed = slug.trim();
  if (!trimmed) {
    return undefined;
  }
  return vscode.Uri.parse(`${GITHUB_BASE}/${trimmed}`);
}

/**
 * Resolves an issue reference to a GitHub issues URL.
 *
 * @param owner - Repository owner (from git remote or @user/repo)
 * @param repo - Repository name
 * @param number - Issue or PR number
 * @returns URI for the GitHub issue, or undefined if any part is missing
 */
export function resolveIssueRefTarget(
  owner: string,
  repo: string,
  number: number
): vscode.Uri | undefined {
  const o = owner?.trim();
  const r = repo?.trim();
  if (!o || !r || number === null || number === undefined || number < 1) {
    return undefined;
  }
  return vscode.Uri.parse(`${GITHUB_BASE}/${o}/${r}/issues/${number}`);
}
