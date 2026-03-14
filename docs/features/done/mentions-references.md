---
status: DONE
updateDate: 2025-03-13
priority: P2
---

# GitHub-style Mentions and References

## Overview

Inline styling and optional linking for GitHub-style `@username`, `@org/team`, `#123`, and `@user/repo#456` in markdown. When the workspace is in "GitHub context" (git remote points to GitHub or override is set), mentions and issue references become clickable.

## Implementation

- Parser: post-pass in `src/parser.ts` (`scanMentionAndIssueRefs`) after AST processing; excludes code blocks and email patterns; emits `mention` and `issueReference` decorations with `slug`, `issueNumber`, `ownerRepo` metadata.
- URL resolution: `src/link-targets.ts` — `resolveMentionTarget(slug)`, `resolveIssueRefTarget(owner, repo, number)`.
- Context: `src/forge-context.ts` — `getForgeContext(workspaceRootUri)`.
- Styling: `src/decorations.ts` (MentionDecorationType, IssueReferenceDecorationType), `src/decorator/decoration-type-registry.ts`.
- Links: `src/link-provider.ts`, `src/link-click-handler.ts` use decoration metadata and GitHub context to provide DocumentLinks and open on click.

### Patterns

| Pattern           | Example          | Styled as | Click target (when in GitHub context)      |
| ----------------- | ---------------- | --------- | ------------------------------------------ |
| User mention      | `@username`      | Link-like | `https://github.com/username`              |
| Org/team mention  | `@org/team`      | Link-like | `https://github.com/org/team`              |
| Issue reference   | `#123`           | Link-like | `https://github.com/owner/repo/issues/123` |
| Repo-scoped issue | `@user/repo#456` | Link-like | `https://github.com/user/repo/issues/456`  |

Segment rules: alphanumeric and hyphen only; no leading hyphen. Underscore not allowed. Exclusions: code blocks, inline code, email-like patterns. Reveal on select: selection shows raw `@user` / `#123`.

### Settings

- **`markdownInlineEditor.mentions.enabled`** (default: `true`) — Master switch for detection and styling.
- **`markdownInlineEditor.mentions.linksEnabled`** — `true` = force links on; `false` = force off; unset = use git remote (GitHub only).

### Context behavior

Forge context from `getForgeContext(workspaceRootUri)`; link provider and click handler only provide/open URLs when context is enabled.

## Acceptance Criteria

- `@username`, `@org/team`, `#123`, `@user/repo#456` are styled (link-like) when `mentions.enabled` is true.
- In GitHub context, they are clickable and open the correct GitHub URL.
- When `mentions.linksEnabled` is false or not in GitHub context, styling remains but links are not provided.
- Email patterns and content inside code blocks/inline code are not styled as mentions.
- Selecting a mention/ref reveals raw markdown; deselecting restores styled view.

## Notes

- Feature 005; spec and plan in `specs/005-mentions-references/`.
- Tests: `src/parser/__tests__/parser-mention-ref.test.ts`, `src/forge-context/__tests__/forge-context.test.ts`.

## Examples

- `@alice` → styled as link; in GitHub context click opens `https://github.com/alice`
- `@org/team` → styled as link; in GitHub context click opens `https://github.com/org/team`
- `#42` → styled as link; in GitHub context click opens repo issue #42 (owner/repo from git remote)
- `@owner/repo#99` → styled as link; in GitHub context click opens `https://github.com/owner/repo/issues/99`
- `user@domain.com` → not styled as mention (email exclusion)
- Content inside `` `code` `` or fenced blocks → no mention/ref styling
