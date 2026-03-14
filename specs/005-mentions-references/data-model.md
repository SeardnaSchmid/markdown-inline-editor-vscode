# Data Model: GitHub-style Mentions and References

**Feature**: 005-mentions-references  
**Date**: 2025-03-13

## Overview

This feature does not introduce a persistent storage model. All data is derived at runtime from document text and workspace state. The following entities describe the in-memory and API-facing shapes used by the parser, context detection, and link providers.

---

## Entities

### Mention

Represents a user or org/team reference in markdown text.

| Attribute | Type                | Description                                                   |
| --------- | ------------------- | ------------------------------------------------------------- |
| startPos  | number              | Start offset in normalized document text (0-based, inclusive) |
| endPos    | number              | End offset in normalized document text (0-based, exclusive)   |
| kind      | `'mention'`         | Decoration type for styling and link provider                 |
| slug      | string              | The segment after `@` (e.g. `username`, `org/team`)           |
| url       | string \| undefined | Resolved URL when in GitHub context; otherwise undefined      |

**Validation**:

- `slug` for simple mention: alphanumeric and hyphen only; no leading hyphen.
- `slug` for org/team: one slash; segments before and after follow same character rules.
- `url` is set only when context is GitHub and resolution succeeds.

**Lifecycle**: Created during parse post-pass; read by decorator and link provider; no state transitions.

---

### IssueReference

Represents an issue or pull request reference (`#123` or `@user/repo#456`).

| Attribute | Type                | Description                                                                                     |
| --------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| startPos  | number              | Start offset in normalized document text                                                        |
| endPos    | number              | End offset in normalized document text                                                          |
| kind      | `'issueReference'`  | Decoration type                                                                                 |
| number    | number              | Issue/PR number (digits after `#`)                                                              |
| ownerRepo | string \| undefined | For `@user/repo#456`, the `user/repo` part; for `#123`, derived from git remote when in context |
| url       | string \| undefined | Resolved URL when in GitHub context                                                             |

**Validation**:

- `number` is one or more digits.
- `ownerRepo` when present: same segment rules as mention slug (alphanumeric, hyphen, one slash).

**Lifecycle**: Same as Mention—created in parse, consumed by decorator and link provider.

---

### GitHubContext

Represents the result of “are we in GitHub context?” for a workspace/document.

| Attribute | Type                | Description                                                    |
| --------- | ------------------- | -------------------------------------------------------------- |
| enabled   | boolean             | True if mention/issue links should be offered (clickable)      |
| remoteUrl | string \| undefined | Git remote URL when available (e.g. for owner/repo extraction) |
| owner     | string \| undefined | Repository owner from remote URL (for `#123` resolution)       |
| repo      | string \| undefined | Repository name from remote URL                                |

**Validation**:

- When `enabled` is true, `remoteUrl` should be present for `#123` resolution; `owner` and `repo` may be derived from it.
- When `enabled` is false, link provider does not set `url` on mention/issueReference decorations.

**State**: Computed per workspace root; cached or recomputed when workspace/configuration changes. No persistence.

---

## Parser representation

The parser emits these as **DecorationRange** entries:

- `type: 'mention'` with metadata for link resolution (e.g. `slug`: the segment after `@`).
- `type: 'issueReference'` with metadata (e.g. `number`, and for repo-scoped refs `ownerRepo`).

The link provider computes `url` when in forge context from this metadata and `getForgeContext`; the parser does not set `url`. When not in context, the link provider does not create DocumentLinks (styled text only). Extend `DecorationRange` or use existing optional fields to carry slug/number/ownerRepo as needed for resolution.

---

## Configuration (config.ts)

| Key (conceptual)        | Type                 | Purpose                                                                                                   |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `mentions.linksEnabled` | boolean \| undefined | Override: if `true`, force GitHub context on; if `false`, force off; if unset, use git remote auto-detect |

Section name follows existing pattern (e.g. `markdownInlineEditor`).
