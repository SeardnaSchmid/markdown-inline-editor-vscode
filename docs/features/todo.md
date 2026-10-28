# TODO Features

Planned features for the Markdown Inline Editor extension. Each item has a brief summary and up to five bullet points.

---

## Default decorator rendering

Control whether markdown files open with decorations on or off by default.

- Add setting under `markdownInlineEditor.defaultBehaviors`, e.g. `decorations.enabledByDefault` (default `true`).
- Initial state applies when opening a file or when the extension activates; existing toggle command still overrides per session.
- Optional: when off by default, skip parsing until the user runs the toggle (reduces CPU/memory with many open markdown files).
- Aligns with existing `defaultBehaviors.diffView.applyDecorations` naming.
- Can later integrate with per-file toggle state when that is implemented.

---

## Default feature activation

Let users enable or disable specific markdown features (headings, links, tables, emoji, etc.) by default.

- Per-feature or per-category config under `markdownInlineEditor.*`; apply at decoration time, not parse time.
- Disabled features render as raw; 3-state visibility (Rendered/Ghost/Raw) and reveal-on-select still work for enabled features.
- Prefer grouping by category (headings, links, lists, code, emoji, tables) to keep settings manageable.
- Avoid re-parsing on config change; apply at decoration layer.
- Stay consistent with diff-view policy (raw by default in diffs).

---

## Highlighting support

Support `==text==` highlighting syntax with background styling and hidden markers.

- Detect `==text==`, style with background color, hide markers; reveal raw on selection.
- Non-standard extension (not GFM); breaks “works everywhere” principle; limited adoption.
- Recommendation: remove from roadmap unless there is strong user demand.
- Feasibility high, usefulness low, effort ~1 week.

---

## Image UX improvements

Improve image experience: click-to-open, richer hover, visual distinction, optional status and thumbnails.

- Phase 1: make images clickable (alt text opens image in VS Code viewer).
- Phase 2: hover shows dimensions, file size, path, “Open Image” button; constrain preview size (e.g. max 400px).
- Phase 3: distinct style for images vs links (color, background, border).
- Phase 4 (optional): status indicators (valid, missing, external, large).
- Phase 5 (future): inline thumbnails with performance/caching considered; or thumbnail only on hover.

---

## Mentions and references styling

**Implemented** — see [`docs/features/done/mentions-references.md`](./done/mentions-references.md) (inline styling, optional forge-aware links, settings `markdownInlineEditor.mentions.*`).

---

## Ordered list auto-numbering

Hide ordered list markers and show computed numbers (1, 2, 3…), including nested lists.

- Hide `1.`, `2.`, etc.; compute numbers from position; support GFM `1)` as well as `1.`.
- Handle nesting and out-of-order source numbering; reveal raw on selection.
- Core GFM; competitive with markless; 2–3 weeks; reassess after core features.
- Feasibility moderate, usefulness high, risk medium (edge cases).

---

## Per-file toggle state

Enable or disable decorations per file instead of globally; state persists across sessions.

- Store toggle state per file URI; add UI control; persist across VS Code sessions.
- New files use default state; renamed files keep state (by URI or migration).
- Competitive advantage (e.g. markless does not have it); good UX for mixed preferences.
- Feasibility high, usefulness high, risk low, effort ~1 week.

---

## Table column alignment (with markup)

Keep table columns aligned when cells contain formatted text (bold, code, italic). Hidden markup changes rendered width and currently breaks alignment.

**Solved for `preview` table style** — see [`done/preview-style-tables.md`](./done/preview-style-tables.md). Sizing each cell as a fixed-width CSS box sidesteps text measurement entirely, so hidden markup no longer changes the column width, and `:---` / `:---:` / `---:` are applied with `text-align`. Still open for the default `grid` style, which pads with spaces and therefore depends on font metrics.

- Measure rendered width of formatted cells (VS Code text measurement or font metrics); adjust column spacing to preserve alignment.
- Handle mixed cells, multiple formatting in one cell, and left/center/right alignment.
- Depends on tables feature; 1–2 weeks; feasibility moderate, usefulness high.
- See: [GitHub issue #21](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/21).

---

## Tables

Full GFM table support: hide pipes, style alignment, support multi-line cells, reveal raw on selection.

- Detect GFM tables; hide `|` delimiters; style alignment (`:---`, `:---:`, `---:`); support multi-line cells.
- Preserve alignment when revealing raw; handle empty cells and inline formatting in cells.
- Core GFM; high demand; competitive requirement; 2–3 weeks; feasibility high, risk medium (edge cases).

