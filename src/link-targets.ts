import * as vscode from "vscode";

export type LinkTarget =
  | { kind: "command"; command: string; args: unknown[] }
  | { kind: "uri"; uri: vscode.Uri };

export function resolveImageTarget(
  url: string,
  documentUri: vscode.Uri,
): vscode.Uri | undefined {
  const trimmed = url.trim();
  if (!trimmed) {
    return;
  }

  if (trimmed.startsWith("/")) {
    return vscode.Uri.file(trimmed);
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("file:")
  ) {
    try {
      return vscode.Uri.parse(trimmed);
    } catch {
      return;
    }
  }

  return vscode.Uri.joinPath(documentUri, "..", trimmed);
}

export function resolveLinkTarget(
  url: string,
  documentUri: vscode.Uri,
): LinkTarget | undefined {
  const trimmed = url.trim();
  if (!trimmed) {
    return;
  }

  if (trimmed.startsWith("#")) {
    const anchor = trimmed.substring(1);
    return {
      kind: "command",
      command: "markdown-inline-editor.navigateToAnchor",
      args: [anchor, documentUri.toString()],
    };
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:")
  ) {
    return { kind: "uri", uri: vscode.Uri.parse(trimmed) };
  }

  if (trimmed.startsWith("file:")) {
    try {
      return { kind: "uri", uri: vscode.Uri.parse(trimmed) };
    } catch {
      return;
    }
  }

  if (trimmed.startsWith("/")) {
    return { kind: "uri", uri: vscode.Uri.file(trimmed) };
  }

  return { kind: "uri", uri: vscode.Uri.joinPath(documentUri, "..", trimmed) };
}

export function toCommandUri(command: string, args: unknown[]): vscode.Uri {
  return vscode.Uri.parse(
    `command:${command}?${encodeURIComponent(JSON.stringify(args))}`,
  );
}

const DEFAULT_WEB_BASE = "https://github.com";

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Resolves a mention slug (@username or @org/team) to a forge profile or team URL.
 *
 * @param slug - The segment after @ (e.g. "alice", "org/team")
 * @param webBaseUrl - Optional forge web base URL (e.g. https://gitlab.com)
 * @returns URI for the profile or team page, or undefined if invalid
 */
export function resolveMentionTarget(
  slug: string,
  webBaseUrl: string = DEFAULT_WEB_BASE,
): vscode.Uri | undefined {
  const trimmed = slug.trim();
  if (!trimmed) {
    return undefined;
  }
  return vscode.Uri.parse(`${normalizeBase(webBaseUrl)}/${trimmed}`);
}

/**
 * Resolves an issue reference to a forge issue URL.
 *
 * @param owner - Repository owner (from git remote or @user/repo)
 * @param repo - Repository name
 * @param number - Issue or PR number
 * @param webBaseUrl - Optional forge web base URL (e.g. https://gitlab.com)
 * @param issuePathSegment - Optional forge issue path segment (e.g. issues, -/issues)
 * @returns URI for the issue, or undefined if any part is missing
 */
export function resolveIssueRefTarget(
  owner: string,
  repo: string,
  number: number,
  webBaseUrl: string = DEFAULT_WEB_BASE,
  issuePathSegment: string = "issues",
): vscode.Uri | undefined {
  const o = owner?.trim();
  const r = repo?.trim();
  if (!o || !r || number === null || number === undefined || number < 1) {
    return undefined;
  }
  const issuePath = issuePathSegment.replace(/^\/+|\/+$/g, "");
  return vscode.Uri.parse(`${normalizeBase(webBaseUrl)}/${o}/${r}/${issuePath}/${number}`);
}
