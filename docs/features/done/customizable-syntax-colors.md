---
status: DONE
updateDate: 2026-03-21
priority: Enhancement
---

# Customizable Syntax Colors

## Overview

Optional hex color overrides for headings and other inline Markdown syntax. When a setting is unset or invalid, the extension falls back to theme-appropriate behavior: **headings** omit a custom `color` on decorations so the editor’s markdown heading syntax colors apply (same idea as raw markdown in the editor); other categories use workbench theme colors where documented (e.g. `textLink.foreground` for links).

## Implementation

- **Configuration**: 15 optional color properties under `markdownInlineEditor.colors` in `package.json`; config getters in `src/config.ts` with hex validation; decoration factories in `src/decorations.ts` accept optional `color`; `src/decorator/decoration-type-registry.ts` wires config to decoration creation; config and theme change trigger `recreateColorDependentTypes()`.
- **Settings**: Keys `heading1` … `heading6`, `link`, `listMarker`, `inlineCode`, `inlineCodeBackground`, `emphasis`, `blockquote`, `image`, `horizontalRule`, `checkbox` (15 total).
- **Format**: Hex `#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA`; invalid/malformed values are ignored and theme default is used (no crash).
- **Behavior**: Changing a color setting or active theme updates open Markdown editors without reload; user-configured hex is preserved when switching themes.

## Acceptance Criteria

```gherkin
Feature: Customizable syntax colors

  Scenario: Set heading color
    When I set "markdownInlineEditor.colors.heading1" to "#e06c75"
    And I open a markdown file with "# Heading"
    Then the heading uses the configured color

  Scenario: Unset uses theme default
    When "markdownInlineEditor.colors.heading1" is unset
    Then heading text uses the theme’s markdown heading colors (syntax highlighting), not a forced editor-wide foreground override

  Scenario: Invalid hex falls back to theme
    When I set "markdownInlineEditor.colors.link" to "not-a-color"
    Then links use textLink.foreground from the theme
    And the extension does not crash

  Scenario: Set inline code background color
    When I set "markdownInlineEditor.colors.inlineCodeBackground" to "#f0f0f0"
    And I open a markdown file with "`code`"
    Then the inline code background uses the configured color

  Scenario: Inline code background uses default when unset
    When "markdownInlineEditor.colors.inlineCodeBackground" is unset
    Then inline code background uses theme-aware default (white for dark, black for light)
```

## Notes

- Delivers US3 (discoverable settings) via schema and descriptions in Settings UI.
- Invalid hex is validated in config getters (regex); decorations receive `undefined`. For **headings**, `undefined` means no `color` on the decoration (theme markdown tokens); for other categories, factories use the documented `ThemeColor` fallbacks where applicable.
- All 15 options are optional; theme-derived defaults per data-model.md.
- `inlineCodeBackground` uses a semi-transparent overlay that composites over the editor background; when unset, uses theme-aware default (white overlay for dark themes, black overlay for light themes).

## Examples

```json
{
  "markdownInlineEditor.colors.heading1": "#e06c75",
  "markdownInlineEditor.colors.link": "#61afef",
  "markdownInlineEditor.colors.inlineCode": "#98c379",
  "markdownInlineEditor.colors.inlineCodeBackground": "#f0f0f0bb",
  "markdownInlineEditor.colors.image": "#61afef",
  "markdownInlineEditor.colors.horizontalRule": "#5c6370",
  "markdownInlineEditor.colors.checkbox": "#98c379"
}
```

## References

- Spec: `specs/002-customizable-syntax-colors/spec.md`
- Issue: [#49](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/49)
