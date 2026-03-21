# Feature Specification: Inherit heading colors from theme

**Feature Branch**: `005-inherit-heading-colors`  
**Created**: 2026-03-21  
**Status**: Draft  
**Input**: User description: GitHub [#57](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/57) — when a heading color is set to **inherit**, inline-rendered headings should use the same colors as the editor’s standard markdown heading styling for the active theme (not a fixed fallback such as white). Related context: [#49](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/49), spec `002-customizable-syntax-colors`.

## Clarifications

### Session 2026-03-21

- **Q:** What is the canonical configuration trigger for “inherit”: an empty color field, an explicit `inherit` value, or both? **→ A:** An **empty** heading color field (no hex) means **theme default**. In this spec and in informal references (e.g. GitHub #57), **inherit** is **shorthand** for that mode—the same behavior described in settings as “Leave empty to use theme default.” A separate explicit `inherit` enum is **not** required unless the product already defines one; if both empty and an explicit inherit exist, they MUST behave the same.

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Inherit matches themed markdown headings (Priority: P1)

As a user with a color theme that assigns distinct colors to markdown headings (for example, a specific color for second-level headings), I **leave the heading color field empty** (theme default—referred to below as **inherit**) so that inline-rendered headings look consistent with how those headings appear when standard editor syntax highlighting applies.

**Why this priority**: This is the reported defect: theme default (empty field) currently fails to follow the theme and can look wrong (e.g. appearing white), breaking visual consistency with the rest of the editor.

**Independent Test**: Use a theme that colors markdown headings distinctly; clear the corresponding heading color field (empty = theme default); open a file with that heading; confirm the inline-rendered heading color matches the appearance when inline preview is turned off for the same theme (same heading level).

**Acceptance Scenarios**:

1. **Given** the active theme styles markdown headings with visible, non-default colors, **when** I leave a heading level’s color **empty** (theme default / **inherit**) in the extension’s color settings, **then** the inline-rendered heading uses the same color family as that heading level in the editor’s normal markdown view for the current theme—not a generic fixed color that ignores the theme.
2. **Given** I have left **inherit** (empty) for a heading level, **when** I switch to a different editor color theme, **then** the inherited heading color updates to follow the new theme’s markdown heading styling for that level (unless I have overridden that level with an explicit custom color).
3. **Given** I have set an explicit custom color for a heading level, **when** I view the file, **then** that explicit color is used; **inherit** (empty) does not override an explicit user color.

---

### User Story 2 – Consistent inherit across heading levels (Priority: P2)

As a user, I expect **inherit** (empty heading color / theme default) to behave predictably for every heading level the extension lets me configure (first through sixth level), not only for one level, so my document’s heading hierarchy stays coherent with the theme.

**Why this priority**: Fixes for one level should not leave others with inconsistent theme-default behavior.

**Independent Test**: For each configurable heading level, leave the color empty (inherit) and verify the rendered color aligns with the theme’s markdown heading styling for that level.

**Acceptance Scenarios**:

1. **Given** the extension exposes color settings for multiple heading levels, **when** I leave **inherit** (empty) for each level in turn, **then** each level’s inline-rendered color follows the theme-appropriate styling for that level, not a single wrong default for all levels.

---

### Edge Cases

- **Explicit color vs inherit (empty)**: If the user sets a valid custom color, that value takes precedence; theme default applies only where the heading color field is **empty** (inherit).
- **Themes with minimal heading distinction**: If the theme gives little or no distinction between heading levels, inherited colors may look similar; the product still follows the theme rather than forcing a contrasting default.
- **Invalid or cleared custom colors**: Behavior remains defined in existing customizable-colors behavior (graceful fallback, no crash); this feature does not change how invalid custom values are handled except that **inherit** (empty) must not be implemented as an incorrect hardcoded color.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For each heading level, when the user leaves the color **empty** (theme default / **inherit**), the extension MUST render that heading level’s inline content using colors consistent with the editor’s themed markdown heading appearance for that level, not a fixed palette color that ignores the active theme (reported example: falling back to white when the theme uses another color).
- **FR-002**: When the user changes the editor color theme, heading levels left **empty** (**inherit**) MUST update to reflect the new theme’s markdown heading styling, without requiring a restart of the editor for that update to apply under normal circumstances.
- **FR-003**: When the user sets an explicit custom color for a heading level, that setting MUST continue to take precedence over **inherit** (empty) for that level.
- **FR-004**: **Inherit** (empty) behavior MUST be consistent for all heading levels (first through sixth level), subject to how the theme differentiates levels.
- **FR-005**: The extension MUST NOT introduce rendering errors or crashes when **inherit** (empty) is used; existing rules for invalid custom colors remain in effect.

### Assumptions

- **A-001**: “Same as normal markdown editor / theme tokens” in the issue is interpreted as visual parity with standard markdown syntax highlighting for headings in the editor for the active theme—what users see with inline preview disabled is the reference for color intent.
- **A-002**: Scope is **heading color** settings where the user leaves the field **empty** (**inherit** / theme default); other syntax categories (links, code, etc.) are unchanged unless they already share the same defect for empty/theme-default (out of scope unless explicitly extended in planning).

### Key Entities

- **Heading color mode**: Per heading level, either an explicit user color (hex) or **inherit** (empty field = theme default).
- **Theme markdown heading appearance**: The colors the editor applies to markdown heading syntax under the current theme—the baseline for **inherit** (empty) must follow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a manual check with at least two distinct color themes, a user can leave a heading level **empty** (**inherit**) and observe that the inline-rendered heading color changes when the theme changes, matching the themed heading appearance (not a single theme-agnostic color across themes).
- **SC-002**: For the scenario in GitHub #57 (theme assigns a specific visible color to second-level markdown headings), with the second-level heading color **empty** (**inherit**), the user can confirm the inline-rendered second-level heading uses that theme-aligned color rather than an incorrect default (e.g. white).
- **SC-003**: No increase in user-visible failures: users who rely on explicit hex colors continue to see those colors unchanged after this behavior fix.
