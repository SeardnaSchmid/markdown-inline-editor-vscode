# Feature Specification: GitHub-style Mentions and References

**Feature Branch**: `005-mentions-references`  
**Created**: 2025-03-13  
**Status**: Draft  
**Input**: User description: "https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/25 — Mentions/References - GitHub-style @username and #123 references"

## Clarifications

### Session 2025-03-13

- Q: How should "GitHub context" (when mentions/references are clickable) be determined? → A: Auto-detect from git remote with optional user override (Option C).
- Q: What characters are allowed in a `@username` mention (the part after `@`)? → A: GitHub-style: alphanumeric and hyphen only, no leading hyphen (Option A).
- Q: Should hover tooltips for mentions/references be in scope for this feature? → A: Out of scope; may be added later (Option A).
- Q: When a mention or issue reference is clickable and opens a URL, how should that link be handled? → A: Same as existing markdown links in the extension (Option A).
- Q: Should styled mentions/references be exposed to assistive technology in any specific way? → A: Expose as links when clickable, as styled text when not (Option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic mentions and issue references are styled and clickable (Priority: P1)

As a user editing markdown (e.g. in a GitHub-related workflow), I want `@username` and `#123` patterns to be visually distinct from normal text and, when in a context where targets are known, clickable so that I can quickly recognize and navigate to people and issues without reading raw syntax.

**Why this priority**: Core value of the feature; without styled basic patterns the feature delivers no benefit.

**Independent Test**: Open a markdown file containing `@alice` and `#42`. Confirm both are styled differently from surrounding text. In a context where links can be resolved, confirm a single action (e.g. click) navigates to the user or issue.

**Acceptance Scenarios**:

1. **Given** a markdown document containing `@username`, **When** the document is displayed in inline-editor mode, **Then** the mention is styled distinctly from surrounding text (e.g. as a reference).
2. **Given** a markdown document containing `#123`, **When** the document is displayed in inline-editor mode, **Then** the issue reference is styled distinctly from surrounding text.
3. **Given** a styled mention or issue reference and a context where the target URL is known, **When** the user performs the standard action to follow a link, **Then** the user is taken to the user profile or issue (or equivalent).

---

### User Story 2 - Extended patterns and multiple references (Priority: P2)

As a user writing documentation or comments with org/team mentions and repo-scoped issue references, I want `@org/team` and `@user/repo#456` to be styled correctly and multiple references in the same paragraph to each be styled and clickable independently so that complex references are readable and navigable.

**Why this priority**: Common in real GitHub/GitLab content; supports team and cross-repo workflows.

**Independent Test**: Add text with `@org/team` and `@user/repo#456` and several `#n` in one paragraph. Confirm each pattern is styled and only the mention/reference span is affected, not surrounding words.

**Acceptance Scenarios**:

1. **Given** text containing `@org/team`, **When** displayed in inline-editor mode, **Then** the full org/team mention is styled as a single reference.
2. **Given** text containing `@user/repo#456`, **When** displayed in inline-editor mode, **Then** the combined reference is styled as a single reference (e.g. pull request or issue in repo).
3. **Given** a paragraph with multiple `@mention` and `#n` tokens, **When** displayed, **Then** each token is independently styled and clickable without styling or capturing surrounding text.

---

### User Story 3 - Reveal raw markdown on selection (Priority: P3)

As a user who sometimes needs to edit the exact characters, I want selecting a styled mention or reference to reveal the raw markdown (e.g. `@user` or `#123`) and when I deselect, the styled view to return so that I can both use the rich view and edit the source when needed.

**Why this priority**: Aligns with existing “reveal raw” behavior of the extension and supports editing without switching modes.

**Independent Test**: Click or select a styled mention or reference. Confirm the selection shows raw syntax. Deselect and confirm the styled view returns.

**Acceptance Scenarios**:

1. **Given** a styled mention or issue reference, **When** the user selects that span, **Then** the raw markdown (e.g. `@username` or `#123`) is shown for the selection.
2. **Given** the user has selected a mention/reference (raw visible), **When** the user deselects or moves focus away, **Then** the styled reference appearance is restored.

---

### Edge Cases

- **Email addresses**: Strings that are valid email addresses (e.g. `user@example.com`) MUST NOT be treated as mentions; only `@` patterns that are not part of an email are styled as mentions.
- **Issue reference with preceding text**: A phrase like `Issue #123` or `see #456` MUST correctly detect and style only the `#123` / `#456` segment as an issue reference, not the surrounding words.
- **Ambiguous @**: When `@` appears in a context that could be email (e.g. `contact user@domain.com`) only the email form is excluded; other `@identifier` forms are treated as mentions per the pattern rules.
- **No link context**: When the editor or document is not in a “GitHub context” (or equivalent), mentions and references are still styled but may not be clickable; the system MUST NOT break or show errors.

### Out of scope

- Hover tooltips showing user or issue info (e.g. display name, issue title) are out of scope for this feature and may be added in a later release.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect and style user mention patterns: `@username` where the username consists of alphanumeric characters and hyphens only (no leading hyphen), GitHub-style.
- **FR-002**: The system MUST detect and style organization/team mention patterns: `@org/team` (e.g. segment after `@` containing one slash).
- **FR-003**: The system MUST detect and style numeric issue reference patterns: `#123` (numeric segment after `#`).
- **FR-004**: The system MUST detect and style combined repo-scoped reference patterns: `@user/repo#456` (user/repo followed by `#` and digits).
- **FR-005**: Styling MUST apply only to the mention or reference span; surrounding text in the same paragraph MUST remain unstyled by this feature.
- **FR-006**: When the document or workspace is in a context where mention/issue targets can be resolved, the system MUST allow the user to trigger navigation from styled mentions and references (e.g. via the same interaction used for other links in the editor). Link handling (e.g. open in browser, security) MUST match existing markdown link behavior in the extension.
- **FR-007**: The system MUST NOT treat email addresses (e.g. `local@domain.tld`) as mentions; detection MUST exclude patterns that form a valid email.
- **FR-008**: The system MUST recognize issue references when `#digits` is preceded by text (e.g. `Issue #123` or `see #456`) and style only the `#digits` part.
- **FR-009**: When the user selects a styled mention or reference, the system MUST reveal the raw markdown for that span; when the user deselects, the system MUST restore the styled view.
- **FR-010**: Multiple mentions and references in the same paragraph MUST each be detected, styled, and (when in context) clickable independently.
- **FR-011**: When a mention or issue reference is clickable (in context), it MUST be exposed to assistive technology with link semantics consistent with other markdown links; when not clickable, it MUST be exposed as styled text only.

### Key Entities

- **Mention**: A segment of text matching @-mention patterns (`@username` with alphanumeric and hyphen only, no leading hyphen; `@org/team`), representing a user or team reference; has a display form and optional target URL when in a resolving context.
- **Issue/Reference**: A segment of text matching `#digits` or `@user/repo#digits`, representing an issue or pull request reference; has a display form and optional target URL when in a resolving context.
- **Context**: Determined by auto-detecting a GitHub-like git remote for the workspace, with an optional user/workspace setting to override (enable or disable). When in context, mention and issue targets can be resolved and made clickable.

## Assumptions

- “GitHub context” is determined by auto-detecting a GitHub-like git remote for the workspace; a user or workspace setting MAY override this (force enable or disable). When in context, mention and issue links can be resolved and are clickable; when not in context, styling still applies but click-to-navigate may be unavailable.
- Mention and reference patterns follow common GitHub Flavored Markdown conventions; org/team and repo#issue patterns are those typically used on GitHub/GitLab.
- Reveal-on-select applies to the same interaction model as existing “reveal raw” behavior in the extension (e.g. selection within the decorated region).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users see all intended mention and issue reference patterns visually distinct from body text in under one second of opening or switching to the document.
- **SC-002**: In a context where targets are resolvable, users can navigate from a mention or issue reference with a single standard link-follow action (e.g. click) without errors.
- **SC-003**: Zero false positives: no email address is styled as a mention in representative test data (e.g. common email formats in prose).
- **SC-004**: When a user selects a styled mention or reference, the raw form is visible; when they deselect, the styled form is restored, with no loss of content or incorrect span boundaries.
- **SC-005**: In a paragraph containing multiple mentions and references, each pattern is correctly identified and styled with no overlap or missed tokens in representative samples.
