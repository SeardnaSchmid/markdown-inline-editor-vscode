# Contract: Mention and Issue-Reference Patterns

**Feature**: 005-mentions-references  
**Type**: Parser / scanner contract (behavioral)

## Purpose

Define the patterns that the mention/issue-reference scanner MUST recognize and MUST NOT recognize so that tests and other consumers can rely on consistent behavior.

---

## Patterns to recognize

All positions are in **normalized** document text (LF line endings). Matches MUST be outside code blocks and inline code (existing scope filtering applies).

### 1. User mention — `@username`

- **Pattern**: `@` followed by a segment of one or more characters.
- **Segment**: Alphanumeric (`[A-Za-z0-9]`) and hyphen (`-`) only. **No leading hyphen** (first character after `@` must be alphanumeric).
- **Examples**: `@alice`, `@user-name`, `@a1`. Not: `@-foo`, `@user_name` (underscore not allowed per spec).
- **Exclusion**: If the `@` is part of a substring that looks like an email (see Email exclusion), do NOT emit a mention.

### 2. Org/team mention — `@org/team`

- **Pattern**: `@` followed by a segment containing **exactly one** slash, with non-empty segments before and after the slash.
- **Segments**: Same character set as user mention (alphanumeric and hyphen, no leading hyphen per segment).
- **Examples**: `@org/team`, `@my-org/team-name`. Not: `@org/team/sub`, `@/team`, `@org/`.

### 3. Issue reference — `#123`

- **Pattern**: `#` followed by one or more ASCII digits.
- **Examples**: `#1`, `#123`, `#999`. May be preceded by other text on the same line (e.g. `Issue #123`, `see #456`); only the `#digits` span is decorated.
- **Exclusion**: None for digits-only. (Hash in URL or other contexts is handled by existing markdown link parsing where applicable.)

### 4. Repo-scoped issue reference — `@user/repo#456`

- **Pattern**: Same as org/team mention (`@user/repo`) immediately followed by `#` and one or more digits, with no space between.
- **Examples**: `@owner/repo#42`, `@my-org/repo-name#1`.
- **Emitted as**: Single decoration spanning `@user/repo#456`; type `issueReference`; optional `url` when in context.

---

## Email exclusion

Before emitting a mention for an `@` match:

- If the substring **before** `@` (back to start of line or previous non-email-allowed character) and the substring **after** `@` together form a string that looks like an email (e.g. `local@domain.tld`), do **not** emit a mention.
- “Looks like email”: local part allows alphanumeric, `.`, `_`, `%`, `+`, `-`; domain part contains at least one `.` and no space/newline. Conservative: when in doubt, treat as email and skip.

---

## Overlap and precedence

- When both a mention and an issue reference could match (e.g. `@user/repo#456`), emit one **issueReference** decoration for the full span.
- Do not emit a separate mention for `@user/repo` when it is part of `@user/repo#456`.
- Multiple non-overlapping matches in the same paragraph are all emitted (e.g. `See @alice and #42` → two decorations).

---

## Code block exclusion

Matches inside **code blocks** (fenced or indented) or **inline code** MUST NOT produce decorations. Use the same logic as existing parser (e.g. scopes or ancestor check) so that mention/ref scan respects code boundaries.
