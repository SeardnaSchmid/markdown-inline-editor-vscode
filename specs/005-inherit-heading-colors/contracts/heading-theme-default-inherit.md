# Contract: Heading theme default (empty / inherit)

**Feature:** `005-inherit-heading-colors`  
**Consumers:** `Heading1DecorationType` … `Heading6DecorationType` via `createHeadingDecoration` in `src/decorations.ts`

## Inputs

- `level`: integer `1`–`6` (heading level).
- `color`: `string | ThemeColor | undefined`
  - In production, `config` supplies **hex string** or **`undefined`** (empty / invalid setting). `ThemeColor` is supported for tests and potential future use.

## Behavior

1. **When `color` is a non-empty hex string** (from config):  
   The decoration type **MUST** include `color: <hex>` in addition to the level-specific `font-size` / `font-weight` rules.

2. **When `color` is `undefined`** (theme default / “inherit”):  
   The decoration type **MUST NOT** set a top-level `color` property.  
   The decoration **MUST** still apply `HEADING_CONFIG` sizing and weight so heading levels remain distinct.

3. **When `color` is a `ThemeColor` instance** (tests or explicit callers):  
   The decoration type **MUST** include `color: <ThemeColor>` (existing behavior preserved).

## Non-goals

- This contract does **not** define TextMate scope names; it relies on VS Code’s default behavior when `color` is omitted.
- Other syntax categories (links, lists, etc.) are unchanged unless they share the same bug; see spec A-002.

## Regression

- Explicit user hex for any heading level **MUST** continue to render with that hex after changes.
