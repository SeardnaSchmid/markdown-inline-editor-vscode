# Data model: Inherit heading colors from theme

## Configuration (VS Code settings)

| Namespace | Keys | Type | Notes |
|-----------|------|------|--------|
| `markdownInlineEditor.colors` | `heading1` … `heading6` | `string` (optional) | Hex `#RGB` / `#RRGGBB` / etc. per `HEX_COLOR_REGEX` in `config.ts` |

**Validation:**

- `parseHexColor`: trim; must match hex regex or **invalid → treated as unset** (`undefined`).
- Empty string `""` → `undefined` (inherit).

## Derived concept: Heading color mode (per level)

| Mode | Source | Decoration behavior |
|------|--------|---------------------|
| **Explicit** | Valid hex in `colors.headingN` | Heading decoration includes `color: <hex>`. |
| **Theme default (inherit)** | No valid hex (`undefined`) | Heading decoration **omits** `color`; keeps size/weight from `HEADING_CONFIG`. |

## Relationships

- `config.colors.headingN()` → `string | undefined` → passed to `HeadingNDecorationType(color?)` → `createHeadingDecoration(level, color)`.
- No persistent storage beyond VS Code settings; no new entities.

## State transitions

| Event | Effect |
|-------|--------|
| User clears heading color or sets invalid value | `undefined` → theme-default path. |
| User sets valid hex | Explicit hex path. |
| `workspace.onDidChangeConfiguration` affecting `markdownInlineEditor.colors` | `recreateColorDependentTypes()` — decoration types rebuilt with new colors. |
| `window.onDidChangeActiveColorTheme` | Same — ensures inherited (no-color) headings pick up new theme token colors. |
