import * as vscode from "vscode";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { config } from "./config";

/**
 * Result of forge context detection for a workspace root.
 * When enabled, mention and issue reference links are clickable.
 */
export interface ForgeContextResult {
  /** True if mention/issue links should be clickable. */
  enabled: boolean;
  /** Git remote URL (e.g. https://host/owner/repo or git@host:owner/repo.git). */
  remoteUrl?: string;
  /** Web base URL for mention and issue links (e.g. https://github.com, https://gitlab.example.com). */
  webBaseUrl?: string;
  /** Repository owner parsed from remoteUrl when applicable. */
  owner?: string;
  /** Repository name (without .git) parsed from remoteUrl when applicable. */
  repo?: string;
  /** Relative issue path segment used by this forge (e.g. issues, -/issues). */
  issuePathSegment?: string;
}

const DEFAULT_WEB_BASE = "https://github.com";

/** Cache of git remote detection results keyed by workspace fsPath. */
const gitRemoteCache = new Map<string, GitRemoteParsed | null>();

/**
 * Determines whether the given workspace root is in forge context
 * (mention and issue references are clickable).
 * Uses git remote auto-detect and optional setting override.
 */
export function getForgeContext(rootUri: vscode.Uri): ForgeContextResult {
  const override = config.mentions.linksEnabled();

  if (override === false) {
    return { enabled: false };
  }

  const fsPath = rootUri.fsPath;
  if (!fsPath) {
    return { enabled: true, webBaseUrl: DEFAULT_WEB_BASE, issuePathSegment: "issues" };
  }

  let fromGit: GitRemoteParsed | undefined;
  if (gitRemoteCache.has(fsPath)) {
    fromGit = gitRemoteCache.get(fsPath) ?? undefined;
  } else {
    fromGit = detectGitRemote(fsPath);
    gitRemoteCache.set(fsPath, fromGit ?? null);
  }

  return {
    enabled: true,
    remoteUrl: fromGit?.remoteUrl,
    webBaseUrl: fromGit?.webBaseUrl ?? DEFAULT_WEB_BASE,
    owner: fromGit?.owner,
    repo: fromGit?.repo,
    issuePathSegment: fromGit?.issuePathSegment ?? "issues",
  };
}

interface GitRemoteParsed {
  remoteUrl: string;
  webBaseUrl: string;
  owner: string;
  repo: string;
  issuePathSegment: string;
}

function detectGitRemote(fsPath: string): GitRemoteParsed | undefined {
  try {
    const url = execSync("git remote get-url origin", {
      cwd: fsPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return parseGitRemoteUrl(url);
  } catch {
    return tryReadGitConfig(fsPath);
  }
}

/**
 * Parses owner/repo and web host details from a forge remote URL.
 * Supports https://host/owner/repo(.git), ssh://git@host/owner/repo(.git), and git@host:owner/repo(.git).
 */
export function parseGitRemoteUrl(url: string): GitRemoteParsed | undefined {
  const trimmed = url.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("://")) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return undefined;
    }

    const host = parsed.hostname;
    if (!host) {
      return undefined;
    }

    const pathPart = parsed.pathname.replace(/^\/+/, "");
    const webBaseUrl =
      parsed.protocol === "http:" || parsed.protocol === "https:"
        ? `${parsed.protocol}//${parsed.host}`
        : buildWebBaseUrl(host);
    return parseOwnerRepoPath(
      trimmed,
      pathPart,
      webBaseUrl,
      issuePathSegmentForHost(host),
    );
  }

  const scpMatch = trimmed.match(/^(?:[^@\s]+@)?([^:\s]+):([^\s]+)$/i);
  if (scpMatch) {
    const host = scpMatch[1];
    return parseOwnerRepoPath(
      trimmed,
      scpMatch[2],
      buildWebBaseUrl(host),
      issuePathSegmentForHost(host),
    );
  }

  return undefined;
}

function parseOwnerRepoPath(
  remoteUrl: string,
  rawPath: string,
  webBaseUrl: string,
  issuePathSegment: string,
): GitRemoteParsed | undefined {
  const normalized = rawPath.replace(/\.git$/i, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const repo = parts[parts.length - 1];
    const owner = parts.slice(0, -1).join("/");
    if (!owner || !repo) {
      return undefined;
    }
    return {
      remoteUrl,
      webBaseUrl,
      owner,
      repo,
      issuePathSegment,
    };
  }
  return undefined;
}

function buildWebBaseUrl(host: string): string {
  const scheme = /^localhost$|^127\.|^\[::1\]$/i.test(host) ? "http" : "https";
  return `${scheme}://${host}`;
}

function issuePathSegmentForHost(host: string): string {
  return host.toLowerCase().includes("gitlab") ? "-/issues" : "issues";
}

function tryReadGitConfig(
  workspaceFsPath: string,
): GitRemoteParsed | undefined {
  try {
    const configPath = path.join(workspaceFsPath, ".git", "config");
    const content = fs.readFileSync(configPath, "utf8");
    const urlMatch = content.match(
      /\[remote\s+"origin"\][\s\S]*?url\s*=\s*(.+)/,
    );
    if (urlMatch) {
      const url = urlMatch[1].trim();
      return parseGitRemoteUrl(url);
    }
  } catch {
    // ignore
  }
  return undefined;
}
