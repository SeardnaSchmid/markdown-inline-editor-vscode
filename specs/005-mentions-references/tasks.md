# Tasks: GitHub-style Mentions and References

**Input**: Design documents from `/specs/005-mentions-references/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per project constitution (AGENTS.md): every new or changed behavior has corresponding tests.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Source: `src/` at repository root
- Tests: `src/<module>/__tests__/<module>.test.ts`

---

## Phase 1: Setup

**Purpose**: Verify environment and feature branch

- [x] T001 Verify branch `005-mentions-references` and run `npm run validate` from repo root
- [x] T002 [P] Add `mentions.linksEnabled` and optional `mentions.enabled` to config in `src/config.ts` per data-model.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: GitHub context and URL resolution that all user stories depend on. No parser or decorations yet.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [x] T003 Implement `getForgeContext(workspaceRootUri)` and `ForgeContextResult` in `src/forge-context.ts` per contracts/forge-context-api.md (git remote + setting override)
- [x] T004 [P] Add tests for forge context (enabled/disabled, override, owner/repo parsing) in `src/forge-context/__tests__/forge-context.test.ts`
- [x] T005 Add `resolveMentionTarget(slug)` and `resolveIssueRefTarget(owner, repo, number)` (or extend `resolveLinkTarget`) for GitHub URLs in `src/link-targets.ts` (or new module used by link-provider)

**Checkpoint**: Context and URL resolution ready; parser and link integration can start.

---

## Phase 3: User Story 1 — Basic mentions and issue references styled and clickable (Priority: P1) — MVP

**Goal**: `@username` and `#123` are visually distinct and clickable when in GitHub context.

**Independent Test**: Open a markdown file containing `@alice` and `#42`. Confirm both are styled differently from surrounding text. In a GitHub workspace (or with override), confirm single click navigates to user profile or issue.

### Implementation for User Story 1

- [x] T006 [US1] Add `DecorationType` union members `'mention'` and `'issueReference'` in `src/parser.ts`
- [x] T007 [US1] Implement post-pass (or scan) in `src/parser.ts` to detect `@username` (alphanumeric + hyphen, no leading hyphen) and `#digits`; exclude matches inside code blocks/inline code; exclude email patterns per contracts/mention-issue-patterns.md; push decoration ranges and scopes for reveal
- [x] T008 [P] [US1] Add `MentionDecorationType` and `IssueReferenceDecorationType` (link-like styling) in `src/decorations.ts`
- [x] T009 [US1] Register `mention` and `issueReference` in `src/decorator/decoration-type-registry.ts` and apply in decorator pipeline
- [x] T010 [US1] In `src/link-provider.ts` (and click handler if needed), when providing DocumentLinks for mention/issueReference decorations: call `getForgeContext` for the document workspace; when enabled, compute URL via resolve functions and supply as link target (URL is computed at link-provider time, not stored on decoration by parser)
- [x] T011 [US1] Extend `provideDocumentLinks` in `src/link-provider.ts` to include mention and issueReference decorations: when in GitHub context compute URL from decoration metadata (slug, number, ownerRepo) and create DocumentLinks; when not in context omit links (styled text only)
- [x] T012 [US1] Extend click handling in `src/link-click-handler.ts` to open URL for mention and issueReference decorations when in forge context (compute URL from decoration metadata + getForgeContext, same as link-provider)
- [x] T013 [P] [US1] Add parser tests for mention and issue-ref patterns, email exclusion, and code-block exclusion in `src/parser/__tests__/parser-mention-ref.test.ts`; include a large-file case (e.g. >10k lines) for mention/ref scan per constitution IV

**Checkpoint**: User Story 1 is complete; `@username` and `#123` are styled and clickable in context; tests pass.

---

## Phase 4: User Story 2 — Extended patterns and multiple references (Priority: P2)

**Goal**: `@org/team` and `@user/repo#456` are styled and clickable; multiple refs in one paragraph work independently.

**Independent Test**: Add text with `@org/team` and `@user/repo#456` and several `#n` in one paragraph. Confirm each pattern is styled and only the span is affected; each is clickable when in context.

### Implementation for User Story 2

- [x] T014 [US2] Extend mention/issue-ref scan in `src/parser.ts` to detect `@org/team` (one slash, same segment rules) and `@user/repo#456` (repo-scoped issue); emit single decoration per match; prefer issueReference for `@user/repo#456` over separate mention
- [x] T015 [US2] Ensure URL resolution supports `@org/team` and `@user/repo#456` in `src/link-targets.ts` (or existing resolver); link provider and click handler use decoration metadata (slug, ownerRepo, issueNumber) per T011/T012
- [x] T016 [P] [US2] Add parser tests for `@org/team`, `@user/repo#456`, and multiple refs in same paragraph in `src/parser/__tests__/parser-mention-ref.test.ts`

**Checkpoint**: User Stories 1 and 2 are complete; extended patterns and multiple refs work.

---

## Phase 5: User Story 3 — Reveal raw markdown on selection (Priority: P3)

**Goal**: Selecting a styled mention or reference shows raw markdown; deselecting restores styled view.

**Independent Test**: Select a styled mention or reference; confirm raw `@user` or `#123` is shown. Deselect; confirm styled view returns.

### Implementation for User Story 3

- [x] T017 [US3] Ensure mention and issueReference ranges are added to scopes in `src/parser.ts` so visibility model shows raw when selection overlaps (if not already done in T007); verify no double-scoping or overlap issues
- [x] T018 [P] [US3] Add tests (or extend decorator/parser tests) for reveal-on-select behavior for mention and issueReference in `src/decorator/__tests__/` or `src/parser/__tests__/` as appropriate

**Checkpoint**: All three user stories are complete; reveal-on-select works for mentions and refs.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and consistency.

- [x] T019 [P] Add or update feature documentation in `docs/features/` for mentions and references (pattern summary, setting, context behavior)
- [x] T020 Run quickstart validation from `specs/005-mentions-references/quickstart.md` (manual test steps and `npm test`)
- [x] T021 Run `npm run validate` and fix any lint or test failures; ensure CRLF tests considered if parser touches positions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories.
- **Phase 3 (US1)**: Depends on Phase 2 — first user-facing increment (MVP).
- **Phase 4 (US2)**: Depends on Phase 3 — extends parser and resolution.
- **Phase 5 (US3)**: Depends on Phase 3 (scopes/reveal); may be done in parallel with Phase 4 if scopes already added in T007.
- **Phase 6 (Polish)**: Depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: After Foundational only — no other story required.
- **US2 (P2)**: After US1 — extends same parser and link flow.
- **US3 (P3)**: After US1 — relies on mention/issueReference decorations and scopes from US1.

### Parallel Opportunities

- T002 and T004 can run in parallel with other Phase 1/2 tasks where no file conflicts.
- T008 and T013 can run in parallel within US1 (decorations vs parser tests).
- T014 and T016 (US2) and T017 and T018 (US3) can be parallelized by different owners (parser vs tests).
- T019 is parallel to T020/T021.

---

## Parallel Example: User Story 1

```text
# After T005 complete, in parallel:
T008: "Add MentionDecorationType and IssueReferenceDecorationType in src/decorations.ts"
T013: "Add parser tests in src/parser/__tests__/parser-mention-ref.test.ts"

# After T009, sequential:
T010 (integrate context + URL into parse), then T011, T012 (link provider and click handler).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002).
2. Complete Phase 2: Foundational (T003–T005).
3. Complete Phase 3: User Story 1 (T006–T013).
4. **STOP and VALIDATE**: Run `npm test` and manual check per Independent Test for US1.
5. Demo or commit MVP.

### Incremental Delivery

1. Setup + Foundational → context and URL resolution ready.
2. Add US1 → test independently → MVP.
3. Add US2 → test extended patterns and multiple refs.
4. Add US3 → verify reveal-on-select.
5. Polish (docs, quickstart, validate).

### Format Validation

- All tasks use checkbox `- [ ]`, task ID (T001–T021), [P] only when parallelizable, [USn] only in Phases 3–5.
- Every task description includes file path or explicit command (e.g. `npm run validate`).
