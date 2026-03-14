# Quickstart: GitHub-style Mentions and References

**Feature**: 005-mentions-references  
**Date**: 2025-03-13

## Prerequisites

- Node.js and npm (see repo root).
- VS Code (or compatible) to run the extension.
- Repository is on branch `005-mentions-references` and `npm run validate` passes before starting.

## Build and run

```bash
# From repo root
npm install
npm run build
# Run Extension Development Host from VS Code (F5 or "Run and Debug" > "Extension")
```

## Manual testing

1. **Open a markdown file** in a workspace that has a git remote pointing to GitHub (e.g. this repo).
2. **Add content**:
   - `@username` and `@org/team`
   - `#123` and `@owner/repo#456`
   - An email: `contact dev@example.com` (should not be styled as mention).
   - In a paragraph: `See @alice and #42 for details.`
3. **Verify**:
   - Mentions and issue refs are styled distinctly (e.g. link-like color).
   - When the workspace is a GitHub repo (or override is on), click opens the correct URL.
   - Select a styled mention/ref → raw `@user` / `#123` appears; deselect → styled again.
4. **Override**: Set `markdownInlineEditor.mentions.linksEnabled` to `false` → links should not be clickable; styling still present. Set to `true` in a non-GitHub repo → links clickable if resolution is possible.

@bircni

## Run tests

```bash
npm test
# Or scoped:
npm test -- --testPathPattern="mention|github-context|parser"
```

## Key files (implementation)

| Area     | File(s)                                                                                      |
| -------- | -------------------------------------------------------------------------------------------- |
| Patterns | `src/parser.ts` (post-pass or processText), `parser/__tests__/parser-mention-ref.test.ts`    |
| Context  | `src/forge-context.ts`, `src/forge-context/__tests__/forge-context.test.ts`                  |
| Styling  | `src/decorations.ts`, `src/decorator/decoration-type-registry.ts`                            |
| Links    | `src/link-provider.ts`, `src/link-click-handler.ts`, `src/link-targets.ts` (or new resolver) |
| Config   | `src/config.ts`                                                                              |

## Spec and plan

- [spec.md](./spec.md) — requirements and acceptance criteria.
- [plan.md](./plan.md) — technical context and structure.
- [research.md](./research.md) — decisions (patterns, context, URL resolution).
- [data-model.md](./data-model.md) — entities (Mention, IssueReference, GitHubContext).
- [contracts/](./contracts/) — pattern rules and GitHub context API.
