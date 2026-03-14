# Contract: Forge Context API

**Feature**: 005-mentions-references  
**Type**: Module interface (implementation contract)

## Purpose

Define the interface for forge-context detection so that the link provider and URL resolution can depend on a single implementation (e.g. `forge-context.ts`) that can be tested and overridden in tests.

---

## Interface (TypeScript-style)

```ts
/** Result of forge context detection for a workspace root. */
export interface ForgeContextResult {
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
 * Determines whether the given workspace root is in forge context
 * (mention and issue references are clickable).
 * Uses git remote auto-detect and optional setting override.
 *
 * @param workspaceRootUri - URI of the workspace root folder (or document's workspace)
 * @returns Result with enabled flag and optional owner/repo for #123 resolution
 */
export function getForgeContext(
  workspaceRootUri: vscode.Uri,
): ForgeContextResult | Promise<ForgeContextResult>;
```

---

## Behavior

1. **Override**: If the setting `markdownInlineEditor.mentions.linksEnabled` is defined:
   - `true` → `enabled: true`. Optionally still resolve `remoteUrl` / `owner` / `repo` for `#123` (e.g. from git).
   - `false` → `enabled: false`; `remoteUrl` / `owner` / `repo` may be omitted.
2. **Auto-detect**: If the setting is unset:
   - Resolve workspace root from `workspaceRootUri` (e.g. `fsPath`).
   - Run `git remote get-url origin` (or read `.git/config`) for that path.
   - If the remote URL can be parsed into a forge web base URL plus `owner` and `repo`, expose those values for link resolution.
   - If the remote cannot be parsed, mention links may still be enabled while standalone `#123` references remain unresolved.
3. **No git**: If the workspace is not a git repo or has no origin, mention links may still be enabled via defaults/override while standalone `#123` links remain unresolved unless enough context is available.

---

## URL parsing from remote URL

- `https://host/owner/repo` or `https://host/owner/repo.git` → parse forge web base URL, owner, repo.
- `git@host:owner/repo.git` → parse forge web base URL, owner, repo.
- `ssh://git@host/owner/repo.git` → parse forge web base URL, owner, repo.
- GitLab hosts use `-/issues`; other hosts default to `issues` unless a future resolver adds host-specific handling.
- Malformed URLs do not set owner/repo; standalone `#123` may remain non-clickable.

---

## Testing

Implementations MUST be mockable (e.g. inject a `getForgeContext` in tests). Link provider and click handler tests MAY stub this to return `enabled: true` with fixed owner/repo for deterministic URL resolution.
