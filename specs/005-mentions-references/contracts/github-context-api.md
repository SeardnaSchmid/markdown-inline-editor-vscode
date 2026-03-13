# Contract: GitHub Context API

**Feature**: 005-mentions-references  
**Type**: Module interface (implementation contract)

## Purpose

Define the interface for “GitHub context” detection so that the link provider and URL resolution can depend on a single implementation (e.g. `github-context.ts`) that can be tested and overridden in tests.

---

## Interface (TypeScript-style)

```ts
/** Result of GitHub context detection for a workspace root. */
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

/**
 * Determines whether the given workspace root is in "GitHub context"
 * (mention and issue references are clickable).
 * Uses git remote auto-detect and optional setting override.
 *
 * @param workspaceRootUri - URI of the workspace root folder (or document's workspace)
 * @returns Result with enabled flag and optional owner/repo for #123 resolution
 */
export function getGitHubContext(workspaceRootUri: vscode.Uri): GitHubContextResult | Promise<GitHubContextResult>;
```

---

## Behavior

1. **Override**: If the setting `markdownInlineEditor.mentions.linksEnabled` is defined:
   - `true` → `enabled: true`. Optionally still resolve `remoteUrl` / `owner` / `repo` for `#123` (e.g. from git).
   - `false` → `enabled: false`; `remoteUrl` / `owner` / `repo` may be omitted.
2. **Auto-detect**: If the setting is unset:
   - Resolve workspace root from `workspaceRootUri` (e.g. `fsPath`).
   - Run `git remote get-url origin` (or read `.git/config`) for that path.
   - If the URL host contains `github.com` (or known GitHub SSH pattern), set `enabled: true` and parse `owner` and `repo` from the URL path.
   - Otherwise `enabled: false`.
3. **No git**: If the workspace is not a git repo or has no origin, `enabled: false` unless overridden to `true` by setting.

---

## URL parsing from remote URL

- `https://github.com/owner/repo` or `https://github.com/owner/repo.git` → owner, repo.
- `git@github.com:owner/repo.git` → owner, repo.
- Other hosts or malformed URLs → do not set owner/repo; `#123` may remain non-clickable or use a default if desired.

---

## Testing

Implementations MUST be mockable (e.g. inject a `getGitHubContext` in tests). Link provider and click handler tests MAY stub this to return `enabled: true` with fixed owner/repo for deterministic URL resolution.
