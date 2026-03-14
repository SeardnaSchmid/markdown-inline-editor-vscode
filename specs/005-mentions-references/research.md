# Research: GitHub-style Mentions and References

**Feature**: 005-mentions-references  
**Date**: 2025-03-13

## 1. Detection approach (mention and issue-ref patterns)

**Decision**: Post-pass over normalized document text (after AST visit), skipping ranges that fall inside code blocks or inline code using existing scope/position info. Do not add remark plugins; patterns are not part of standard markdown AST.

**Rationale**: Remark does not expose `@mention` or `#123` as nodes; they appear inside `text` nodes. Options were: (a) visit every text node and run regex (like emoji shortcodes), (b) single post-pass over full normalized text and exclude code regions. (b) keeps one place for all patterns, reuses existing `filterDecorationsInCodeBlocks`-style logic, and avoids touching processText for multiple features.

**Alternatives considered**: Remark plugin that injects mention/ref nodes—adds dependency and build complexity. Regex in processText—splits logic across many text nodes and duplicates code-block exclusion.

---

## 2. GitHub username and mention pattern rules

**Decision**: Apply spec-clarified rules: `@username` = alphanumeric and hyphen only, no leading hyphen (GitHub-style). `@org/team` = one slash allowed; segment before/after follow same character rules. Issue ref: `#` followed by one or more digits. Repo-scoped: `@user/repo#456` (user and repo segments like username; no leading hyphen).

**Rationale**: Matches GitHub Flavored Markdown and spec clarification (Option A: GitHub-style username).

**Alternatives considered**: Alphanumeric + underscore (rejected per spec). Non-whitespace (too broad, would match `@foo.bar.baz`).

---

## 3. Email exclusion (no false positives)

**Decision**: Before treating a match as a mention, check that the `@` is not part of a substring that matches a simple email pattern (e.g. `local-part@domain.tld`). Use a single regex or helper: if the character range before `@` contains only allowed email-local characters (e.g. alphanumeric, `.`, `_`, `%`, `+`, `-`) and the rest after `@` looks like a domain (e.g. has a `.` and no space), treat as email and skip.

**Rationale**: Spec FR-007 requires no email addresses styled as mentions. A conservative check avoids false positives; edge cases (e.g. `see user@host`) are covered by “looks like email” heuristic.

**Alternatives considered**: No check—rejected (spec). Full RFC-style email validation—unnecessary; simple “has domain part with dot” is enough.

---

## 4. GitHub context detection (clickable when in context)

**Decision**: Implement a small module that: (1) resolves workspace root for the document; (2) runs `git remote get-url origin` (or reads `.git/config`) for that root; (3) treats context as “on” if the URL looks like GitHub (e.g. `github.com` or `git@github.com:...`); (4) reads a VS Code setting (e.g. `markdownInlineEditor.mentions.linksEnabled`) and overrides: if set to true, force on; if false, force off; if unset, use git-based result.

**Rationale**: Spec clarification: auto-detect from git remote with optional user override (Option C). Git CLI is standard in dev environments; fallback to config file if needed. No network call required.

**Alternatives considered**: Setting only—rejected (spec asks for auto-detect + override). Always on—rejected (spec).

---

## 5. URL resolution for mentions and issue references

**Decision**: When in GitHub context, resolve: `@username` → `https://github.com/username`; `@org/team` → `https://github.com/org/team`; `#123` → `https://github.com/<owner>/<repo>/issues/123` (owner/repo from git remote URL); `@user/repo#456` → `https://github.com/user/repo/issues/456`. Reuse existing link opening behavior (same as markdown links); no new security model.

**Rationale**: Spec: link handling same as existing links (Option A). GitHub URL scheme is fixed; owner/repo from remote URL is the only variable for `#123`.

**Alternatives considered**: Different host (e.g. GitLab)—out of scope for this feature; can be extended later via config/host detection.

---

## 6. Integration with existing link provider and click handler

**Decision**: Parser emits `mention` and `issueReference` decorations with metadata (e.g. slug, issue number, ownerRepo for repo-scoped refs) but does not set `decoration.url`. The link provider calls `getForgeContext` for the document workspace and, when enabled, computes the URL from that metadata and the resolve functions, then supplies it as the DocumentLink target. When not in context, no DocumentLink is provided (styled text only—accessibility: link when clickable, text when not).

**Rationale**: Parser stays synchronous; context and URL resolution happen in the link provider, which already has access to the document and can call async `getForgeContext` when building links. Spec FR-006 and FR-011: same interaction as other links; expose as link when clickable, as text when not.

**Alternatives considered**: Separate provider for mention/ref links—rejected to keep one place for “clickable in editor” and same UX as links.
