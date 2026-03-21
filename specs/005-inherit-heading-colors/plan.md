# Implementation Plan: Inherit heading colors from theme

**Branch**: `005-inherit-heading-colors` | **Date**: 2026-03-21 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-inherit-heading-colors/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

When a user leaves a heading color setting **empty** (theme default / “inherit”), inline-rendered headings must match the editor’s normal markdown heading colors for the active theme, instead of falling back to a generic color (`editor.foreground`, typically white in dark themes).

**Technical approach:** Root cause is `createHeadingDecoration` in `src/decorations.ts`, which always sets `color` to `color ?? new ThemeColor('editor.foreground')`, overriding TextMate token colors for heading spans. **When no hex is configured** (`undefined` from `config.colors.headingN()`), **omit the `color` property** from the heading `TextEditorDecorationType` so font size / weight still apply while the underlying syntax-highlighted heading color remains visible. Theme changes already trigger `recreateColorDependentTypes()` via `onDidChangeActiveColorTheme` in `extension.ts`. **Tests:** Update or add coverage in `decorator/__tests__/decoration-colors.test.ts` and any assertions that assumed `editor.foreground` for undefined heading color; run `npm run validate`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node 18+  
**Primary Dependencies**: VS Code Extension API (^1.88.0), remark (unified, markdown parsing), Jest, esbuild  
**Storage**: N/A (settings via VS Code `workspace` configuration)  
**Testing**: Jest (`npm test`), tests in `src/**/__tests__/*.test.ts`  
**Target Platform**: VS Code / Cursor-compatible editors  
**Project Type**: VS Code extension (single package under `src/`)  
**Performance Goals**: No change to parse cadence; decoration types recreated only on config/theme change (existing)  
**Constraints**: Parse cache (`markdown-parse-cache.ts`) unchanged; no full-document parse on selection change; position mapping for CRLF unchanged  
**Scale/Scope**: Six heading levels (`heading1`–`heading6`); empty config = inherit only for those keys

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status |
|-----------|--------|
| **I. Code quality** | Pass — change localized to decoration factory + JSDoc; strict TS; validate before commit. |
| **II. Testing** | Pass — tests required for changed heading default behavior; follow existing mocks. |
| **III. UX consistency** | Pass — aligns inline headings with theme; explicit hex unchanged. |
| **IV. Performance** | Pass — no new parse paths; no O(n²); theme/config listeners already in place. |

**Quality gates**: `npm run validate` before commit — satisfied by design.

## Project Structure

### Documentation (this feature)

```text
specs/005-inherit-heading-colors/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── config.ts              # colors.heading1–6 → undefined when empty/invalid
├── decorations.ts         # Heading1–6DecorationType / createHeadingDecoration (primary fix)
├── decorator.ts           # passes getHeadingNColor from config into registry
├── decorator/
│   └── decoration-type-registry.ts  # creates heading types with optional color
├── extension.ts           # onDidChangeActiveColorTheme → recreateColorDependentTypes
└── decorator/__tests__/
    └── decoration-colors.test.ts    # update expectations for undefined heading color

tests/                     # not used; repo uses src/**/__tests__/
```

**Structure Decision**: Single VS Code extension project; all changes under `src/` with tests colocated in `__tests__/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None — no constitution violations.

## Phase 0 & 1 outputs

| Artifact | Path |
|----------|------|
| Research | [research.md](./research.md) |
| Data model | [data-model.md](./data-model.md) |
| Contracts | [contracts/heading-theme-default-inherit.md](./contracts/heading-theme-default-inherit.md) |
| Quickstart | [quickstart.md](./quickstart.md) |
