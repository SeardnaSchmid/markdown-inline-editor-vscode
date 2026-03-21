# Research: Inherit heading colors from theme (005)

## Problem statement

GitHub [#57](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/57): With empty heading color settings (“Leave empty to use theme default”), inline-rendered headings (e.g. H2, H3) appear **white** instead of the theme’s markdown heading color (e.g. `#0abcff`), while the same file with raw syntax visible shows correct theme colors.

## Root cause (code)

`src/decorations.ts` — `createHeadingDecoration`:

```typescript
const resolvedColor = color ?? new ThemeColor('editor.foreground');
return window.createTextEditorDecorationType({
  color: resolvedColor,
  ...
});
```

`config.colors.headingN()` returns `undefined` when the setting is empty or invalid (see `src/config.ts` `parseHexColor`). When `color` is `undefined`, the code **still forces** `ThemeColor('editor.foreground')`, which overrides the TextMate/syntax coloring for the heading text and no longer matches per-level markdown heading scopes.

## Decision: Omit `color` when config is unset

**Decision:**  
When the heading color argument is **`undefined`** (empty config = theme default), **do not set** `color` on the `TextEditorDecorationType` options object. Continue to set `font-size` / `font-weight` from `HEADING_CONFIG` so inline heading levels remain visually distinct.

**Rationale:**

- VS Code `TextEditorDecorationType` applies **optional** `color`; when omitted, the decoration does not override the editor’s default foreground for that range, so **syntax token colors** (e.g. `heading.2.markdown` / `entity.name.section.markdown`) remain visible—matching “normal” markdown editing with the same theme.
- This avoids inventing non-existent `ThemeColor` IDs for markdown headings (`ThemeColor` only accepts [workbench color IDs](https://code.visualstudio.com/api/references/theme-color); there is no standard per-level `markdown.heading1` etc. in the reference list).
- Theme switches already call `decorator.recreateColorDependentTypes()` (`extension.ts` `onDidChangeActiveColorTheme`), satisfying FR-002 for refreshing decoration types when the theme changes.

**Alternatives considered:**

| Alternative | Why not chosen |
|-------------|----------------|
| Map each level to a `ThemeColor('…')` for markdown headings | No stable built-in IDs for per-level markdown heading colors across themes. |
| Parse `editor.tokenColorCustomizations` / TextMate rules to resolve hex | Fragile, duplicates VS Code work, high maintenance. |
| Use `vscode` proposed APIs to read resolved token color at position | Not required if omitting `color` restores token colors; adds API risk. |
| Keep `editor.foreground` but “blend” | Still wrong hue vs. theme heading colors. |

## Risks and validation

- **Nested styles inside headings** (e.g. bold inside `##`): Omitted `color` should preserve per-token coloring where the editor applies it; manual verification is still recommended.
- **High contrast / accessibility themes**: Behavior should follow the same theme rules as raw markdown; if issues appear, follow-up can be scoped.
- **Explicit hex**: Unchanged — `color` is still set when `config` returns a valid hex string.

## References

- Spec clarifications: [`spec.md`](./spec.md) — empty field = theme default; “inherit” is shorthand.
- `002-customizable-syntax-colors`: user-configured hex when set; theme defaults when unset.
