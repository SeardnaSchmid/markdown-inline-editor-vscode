import * as vscode from "vscode";

export type LinkTarget =
  | { kind: "command"; command: string; args: unknown[] }
  | { kind: "uri"; uri: vscode.Uri };

/**
 * Percent-decode a markdown href path so `link%20test.md` maps to `link test.md`.
 *
 * @param path - Raw href path, possibly percent-encoded
 * @returns Decoded path, or the original string if decoding fails
 */
function decodeMarkdownHrefPath(path: string): string {
  // joinPath would otherwise look for a filename that literally contains "%20"
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Split `file.md#heading` so the fragment is not treated as part of the filename.
 *
 * @param href - Relative or absolute markdown href
 * @returns Path and fragment (empty string when no hash is present)
 */
function splitMarkdownHref(href: string): { path: string; fragment: string } {
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) {
    return { path: href, fragment: "" };
  }
  return { path: href.slice(0, hashIndex), fragment: href.slice(hashIndex + 1) };
}

/**
 * Resolve a local markdown/image path after decoding percent-encoding.
 *
 * @param hrefPath - Path without fragment
 * @param documentUri - URI of the document that contains the href
 * @returns File URI, or undefined when the path is empty
 */
function resolveLocalMarkdownUri(
  hrefPath: string,
  documentUri: vscode.Uri,
): vscode.Uri | undefined {
  const decoded = decodeMarkdownHrefPath(hrefPath);
  if (!decoded) {
    return;
  }
  if (decoded.startsWith("/")) {
    return vscode.Uri.file(decoded);
  }
  return vscode.Uri.joinPath(documentUri, "..", decoded);
}

export function resolveImageTarget(
  url: string,
  documentUri: vscode.Uri,
): vscode.Uri | undefined {
  const trimmed = url.trim();
  if (!trimmed) {
    return;
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

  return resolveLocalMarkdownUri(trimmed, documentUri);
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

  const { path, fragment } = splitMarkdownHref(trimmed);
  const uri = resolveLocalMarkdownUri(path, documentUri);
  if (!uri) {
    return;
  }

  // Relative file plus fragment: open that file then jump to the heading
  if (fragment) {
    return {
      kind: "command",
      command: "markdown-inline-editor.navigateToAnchor",
      args: [fragment, uri.toString()],
    };
  }

  return { kind: "uri", uri };
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
