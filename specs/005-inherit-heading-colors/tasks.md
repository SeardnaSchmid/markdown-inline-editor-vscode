---
description: "Task list for feature 005-inherit-heading-colors"
---

# Tasks: Inherit heading colors from theme

**Input**: Design documents from `/home/schmida/dev/git/markdown-inline-editor-vscode/specs/005-inherit-heading-colors/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/heading-theme-default-inherit.md](./contracts/heading-theme-default-inherit.md), [quickstart.md](./quickstart.md)

**Tests**: Included — constitution and plan require tests for changed heading default behavior (`src/decorator/__tests__/decoration-colors.test.ts`).

**Organization**: Tasks grouped by user story (US1 P1, US2 P2) after setup and baseline.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or independent steps)
- **[Story]**: `[US1]` / `[US2]` for user-story phases only
- Paths are relative to repository root unless noted

## Phase 1: Setup

**Purpose**: Confirm branch and feature artifacts before implementation

- [x] T001 [P] Confirm git branch is `005-inherit-heading-colors` and feature docs exist under `specs/005-inherit-heading-colors/` (plan.md, spec.md, research.md, contracts/)
- [x] T002 [P] Read `specs/005-inherit-heading-colors/contracts/heading-theme-default-inherit.md` and `specs/005-inherit-heading-colors/research.md` so implementation matches agreed omit-`color` behavior for `undefined`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Green baseline before modifying behavior

**⚠️ CRITICAL**: Complete before user story implementation

- [x] T003 Run `npm test` and `npm run build` from repository root; resolve failures unrelated to this feature before proceeding

**Checkpoint**: Baseline build and tests pass — user story work may begin

---

## Phase 3: User Story 1 – Inherit matches themed markdown headings (Priority: P1) 🎯 MVP

**Goal**: Empty heading color (theme default) uses the same visual heading colors as standard markdown syntax highlighting, not a forced `editor.foreground` override.

**Independent test**: Clear a heading color in settings; open markdown with that heading level; compare with raw/syntax-highlighted view per [quickstart.md](./quickstart.md).

### Tests for User Story 1

- [x] T004 [US1] Update `src/decorator/__tests__/decoration-colors.test.ts`: adjust descriptions/assertions for `Heading1DecorationType()` with no args so they reflect **omitted `color`** (theme token visible), not `ThemeColor('editor.foreground')`; extend `src/test/__mocks__/vscode.ts` only if tests need to inspect `createTextEditorDecorationType` options

### Implementation for User Story 1

- [x] T005 [US1] Edit `src/decorations.ts`: in `createHeadingDecoration`, when `color === undefined`, build decoration options **without** a `color` key; when `color` is a hex `string` or `ThemeColor`, set `color` as today. Update JSDoc on `createHeadingDecoration` and `Heading1DecorationType`–`Heading6DecorationType` that currently state undefined maps to `editor.foreground`

**Checkpoint**: US1 behavior implemented; `decoration-colors` tests pass

---

## Phase 4: User Story 2 – Consistent inherit across heading levels (Priority: P2)

**Goal**: H1–H6 all behave the same for empty settings (single shared helper — verify coverage).

**Independent test**: For each level, empty `colors.headingN` and confirm themed appearance per [spec.md](./spec.md) User Story 2.

### Tests for User Story 2

- [x] T006 [US2] In `src/decorator/__tests__/decoration-colors.test.ts`, add coverage that `Heading2DecorationType` through `Heading6DecorationType` invoked with no arguments (and with explicit hex) still construct successfully, mirroring H1 cases so all six levels stay aligned

### Implementation for User Story 2

- [x] T007 [US2] Code review pass on `src/decorations.ts`: confirm `Heading1DecorationType`–`Heading6DecorationType` all route through `createHeadingDecoration` with no per-level default-color override; fix only if a level bypasses the shared path

**Checkpoint**: US2 acceptance satisfied by tests + shared implementation

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validation and documentation alignment

- [x] T008 Run `npm run validate` from repository root (`lint:docs`, `test`, `build`)
- [x] T009 [P] Search `README.md` and `docs/` for heading color / “theme default” / “leave empty” wording; update only if text contradicts empty-field = theme default per `specs/005-inherit-heading-colors/spec.md`
- [ ] T010 [P] Optional manual smoke test following `specs/005-inherit-heading-colors/quickstart.md` (two themes, empty vs explicit hex)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No prerequisites
- **Phase 2 (Foundational)**: Depends on Phase 1 (recommended: read contracts before baseline)
- **Phase 3 (US1)**: Depends on Phase 2 — **MVP deliverable** after T005 + T004 passing
- **Phase 4 (US2)**: Depends on Phase 3 (same files; extends tests and review)
- **Phase 5 (Polish)**: Depends on Phases 3–4 complete

### User Story Dependencies

- **US1**: No dependency on US2 — implement first
- **US2**: Depends on US1 implementation (shared `createHeadingDecoration`); independently testable via per-level empty settings

### Within User Story 1

- T004 (tests) may be updated in lockstep with T005 (implementation); if using TDD, adjust T004 expectations first so they fail, then apply T005

### Parallel Opportunities

| Parallel group | Tasks |
|----------------|-------|
| Setup | T001 ∥ T002 |
| Polish | T009 ∥ T010 (after T008) |
| US1 | T004 and T005 are sequential (same behavior); mock changes in T004 may precede T005 |

---

## Parallel Example: Phase 1

```bash
# Run simultaneously:
# - T001: verify branch and specs/005-inherit-heading-colors/ contents
# - T002: read contracts + research for omit-color decision
```

---

## Parallel Example: User Story 2

```bash
# After US1 is done:
# - T006: extend decoration-colors.test.ts for H2–H6
# - T007: quick read-only review of decorations.ts export path (can follow T006 in same session)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1–2 (T001–T003)
2. Complete Phase 3 (T004–T005)
3. Run `npm test` and `npm run build`
4. **STOP**: Manual check per quickstart — H2 empty matches theme (GitHub #57 scenario)

### Incremental Delivery

1. MVP (US1) → ship or demo
2. Add US2 tasks (T006–T007) → full H1–H6 confidence
3. Polish (T008–T010)

---

## Notes

- Primary code path: `src/decorations.ts` (`createHeadingDecoration`); config `src/config.ts` already returns `undefined` for empty heading colors
- Theme refresh: `src/extension.ts` already calls `recreateColorDependentTypes()` on `onDidChangeActiveColorTheme` — no new subscription required for FR-002
- Avoid editing `dist/`; run `npm run validate` before commit
