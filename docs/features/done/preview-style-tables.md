---
status: DONE
updateDate: 2026-07-27
priority: Medium Priority
---

# Preview-Style Tables

## Overview

An opt-in table rendering mode that mirrors the markdown preview pane: the `|` pipes are hidden, every cell is laid out as a fixed-width CSS box, the header row is bold and the separator row becomes a single horizontal rule.

The existing `grid` rendering pads cell text with non-breaking spaces to a width measured from the source. That only lines up when the editor font renders a full-width glyph at exactly the assumed ratio, so tables mixing CJK and ASCII text come out ragged, as do proportional fonts. Sizing each cell in CSS removes the font from the alignment equation: every cell in a column gets the same width, so the grid is straight whatever the font does, and the width estimate only decides whether the text fits.

Selected with `markdownInlineEditor.tables.style`; `grid` remains the default.

## Implementation

- `tables.style` (`preview` | `grid`, default `grid`) picks the rendering path in `parser/core.ts` `processTable()`
- Preview path emits:
  - `tablePipe` / `tableSeparatorPipe` with an empty replacement, hiding the pipes
  - `tableCell` carrying the plain cell text plus `boxWidth`, `cellAlign`, `isHeaderCell` and `drawRowSeparator`
  - one `tableRule` decoration replacing the whole separator row
- `decorator/visibility-model.ts` turns those into per-range `renderOptions.before` styling: `width: <n>ch`, `display: inline-block`, `box-sizing: border-box`, `padding: 0 1ch`, `overflow: hidden`, `text-align`, and an optional bottom border. This is the same CSS-injection-through-`textDecoration` technique already used by the checkbox and mermaid decorations
- Column width is `max(cell widths) + 1ch padding either side`, clamped by `tables.maxColumnWidth` (default 48)
- `tables.cjkWidthRatio` (default 2) replaces the previous hard-coded "2 columns plus a 25% fudge" estimate. The width scan also now recognises the fullwidth forms block (U+FF00–FF60), so `（`, `）` and friends count as two columns
- `tables.rowSeparators` (default true) draws the thin rule under each data row
- Column alignment (`:---`, `:---:`, `---:`) is applied with `text-align`, so it holds even when a cell contains hidden markup
- Table settings invalidate the parse cache in `registration/register-event-handlers.ts`, since they change parser output rather than just styling
- Cursor-inside-table still reveals the whole block as raw markdown, unchanged

## Acceptance Criteria

```gherkin
Feature: Preview-style tables

  Background:
    Given markdownInlineEditor.tables.style is "preview"

  Scenario: Pipes are hidden
    When I open a document containing a GFM table
    Then no | characters are drawn
    And the separator row is drawn as a single horizontal rule

  Scenario: Columns line up regardless of content width
    When a column contains both ASCII and CJK cells
    Then every cell in that column is rendered at the same width

  Scenario: Header styling
    When a table has a header row
    Then the header cells are bold
    And the header cells have no bottom border of their own

  Scenario: Column alignment
    When a column is declared with ---:
    Then its cells are right-aligned

  Scenario: Long cells are capped
    Given tables.maxColumnWidth is 10
    When a cell contains 80 characters
    Then the column box is 12 character widths wide

  Scenario: Raw reveal is unaffected
    When I place the cursor inside the table
    Then the whole table is shown as raw markdown

  Scenario: Grid style is untouched
    Given markdownInlineEditor.tables.style is "grid"
    When I open a document containing a GFM table
    Then pipes are rendered as │
    And the separator row is rendered as runs of -
```

## Notes

- Cells cannot wrap. An editor line maps to one visual line, so text past `maxColumnWidth` is clipped in the rendered view; moving the cursor into the table shows it in full. Wide tables are best viewed with `editor.wordWrap` off, since a wrapped row breaks the run of cell boxes ([issue #76](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/76))
- `tables.cjkWidthRatio` overlaps with [PR #116](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/pull/116), which proposed the same setting for the grid path
- Addresses the alignment half of [issue #21](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/21) and [issue #41](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/41): in preview style, hidden markup and proportional fonts no longer skew columns

## Examples

Source:

```markdown
| 回  | 日時       | テーマ             | 講師                     |
| --- | ---------- | ------------------ | ------------------------ |
| 1   | 2026/7/10  | イントロダクション | 栗田 駿一郎（HGPI）      |
| 2   | 2026/8/14  | アジェンダ設定(1)  | 市川 衛（武蔵大学）      |
```

`grid` style — pipes drawn, alignment depends on the font:

```text
│ 回  │ 日時       │ テーマ             │ 講師                │
│-----│------------│--------------------│---------------------│
│ 1   │ 2026/7/10  │ イントロダクション │ 栗田 駿一郎（HGPI） │
```

`preview` style — pipes hidden, boxes sized in `ch`, header bold and ruled:

```text
回   日時        テーマ               講師
──────────────────────────────────────────────────────────
1    2026/7/10   イントロダクション   栗田 駿一郎（HGPI）
2    2026/8/14   アジェンダ設定(1)    市川 衛（武蔵大学）
```

Settings:

```json
{
  "markdownInlineEditor.tables.style": "preview",
  "markdownInlineEditor.tables.cjkWidthRatio": 2,
  "markdownInlineEditor.tables.maxColumnWidth": 48,
  "markdownInlineEditor.tables.rowSeparators": true
}
```
