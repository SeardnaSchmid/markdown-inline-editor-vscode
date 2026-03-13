import * as vscode from 'vscode';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';

/**
 * Result of GitHub context detection for a workspace root.
 * When enabled, mention and issue reference links are clickable.
 */
export interface GitHubContextResult {
  /** True if mention/issue links should be clickable. */
  enabled: boolean;
  /** Git remote URL (e.g. https://github.com/owner/repo or git@github.com:owner/repo.git). */
  remoteUrl?: string;
  /** Repository owner parsed from remoteUrl when applicable. */
  owner?: string;
  /** Repository name (without .git) parsed from remoteUrl when applicable. */
  repo?: string;
}

const GITHUB_HOST = 'github.com';

/**
 * Determines whether the given workspace root is in "GitHub context"
 * (mention and issue references are clickable).
 * Uses git remote auto-detect and optional setting override.
 *
 * @param workspaceRootUri - URI of the workspace root folder (or document's workspace)
 * @returns Result with enabled flag and optional owner/repo for #123 resolution
 */
export function getGitHubContext(workspaceRootUri: vscode.Uri): GitHubContextResult {
  const override = config.mentions.linksEnabled();
  if (override === true) {
    const fromGit = detectGitHubRemote(workspaceRootUri);
    return {
      enabled: true,
      remoteUrl: fromGit?.remoteUrl,
      owner: fromGit?.owner,
      repo: fromGit?.repo,
    };
  }
  if (override === false) {
    return { enabled: false };
  }
  const fromGit = detectGitHubRemote(workspaceRootUri);
  if (!fromGit) {
    return { enabled: false };
  }
  return {
    enabled: true,
    remoteUrl: fromGit.remoteUrl,
    owner: fromGit.owner,
    repo: fromGit.repo,
  };
}

interface GitRemoteParsed {
  remoteUrl: string;
  owner: string;
  repo: string;
}

function detectGitHubRemote(workspaceRootUri: vscode.Uri): GitRemoteParsed | undefined {
  const fsPath = workspaceRootUri.fsPath;
  if (!fsPath) {
    return undefined;
  }
  try {
    const url = execSync('git remote get-url origin', {
      cwd: fsPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .trim();
    return parseGitHubRemoteUrl(url);
  } catch {
    return tryReadGitConfig(fsPath);
  }
}

/**
 * Parses owner and repo from GitHub remote URL.
 * Supports https://github.com/owner/repo and git@github.com:owner/repo.git.
 */
export function parseGitHubRemoteUrl(url: string): GitRemoteParsed | undefined {
  const trimmed = url.trim();
  if (!trimmed || !trimmed.includes(GITHUB_HOST)) {
    return undefined;
  }
  let pathPart: string;
  if (trimmed.startsWith('git@github.com:')) {
    pathPart = trimmed.slice('git@github.com:'.length).replace(/\.git$/i, '');
  } else if (trimmed.includes(GITHUB_HOST + '/')) {
    const idx = trimmed.indexOf(GITHUB_HOST + '/');
    pathPart = trimmed.slice(idx + (GITHUB_HOST + '/').length).replace(/\.git$/i, '');
  } else {
    return undefined;
  }
  const parts = pathPart.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return {
      remoteUrl: trimmed,
      owner: parts[0],
      repo: parts[1],
    };
  }
  if (parts.length === 1) {
    return {
      remoteUrl: trimmed,
      owner: parts[0],
      repo: parts[0],
    };
  }
  return undefined;
}

function tryReadGitConfig(workspaceFsPath: string): GitRemoteParsed | undefined {
  try {
    const configPath = path.join(workspaceFsPath, '.git', 'config');
    const content = fs.readFileSync(configPath, 'utf8');
    const urlMatch = content.match(/\[remote\s+"origin"\][\s\S]*?url\s*=\s*(.+)/);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      return parseGitHubRemoteUrl(url);
    }
  } catch {
    // ignore
  }
  return undefined;
}
