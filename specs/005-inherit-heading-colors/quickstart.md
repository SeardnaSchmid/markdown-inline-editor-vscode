# Quickstart: Verify heading theme default (inherit)

## Prerequisites

- Extension built/launched in Extension Development Host (or equivalent).
- A color theme that **visibly differentiates** markdown heading colors from plain text (e.g. custom `editor.tokenColorCustomizations` for `heading.1.markdown` / `heading.2.markdown` …).

## Steps

1. Open **Settings**, search for `markdown inline editor colors heading`.
2. **Clear** (empty) the hex fields for **Heading 1** and **Heading 2** (and optionally H3–H6).
3. Open a markdown file with `# H1`, `## H2`, `### H3` content.
4. **Expected:** Inline-rendered heading text uses the **same colors** as when you disable inline markdown preview / view raw markdown with the same theme (same heading level).

## Regression check

1. Set **Heading 2** to a hex value (e.g. `#0abcff`).
2. **Expected:** H2 uses that exact color regardless of theme default.

## Automated checks

From repo root:

```bash
npm test -- --testPathPattern=decoration-colors
npm run validate
```

Adjust tests if expectations for `HeadingNDecorationType()` without arguments change from “forces editor.foreground” to “omits color”.
