# Implementation Plan: GitHub-style Mentions and References

**Branch**: `005-mentions-references` | **Date**: 2025-03-13 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-mentions-references/spec.md`

## Summary

Add GitHub-style `@username`, `@org/team`, `#123`, and `@user/repo#456` detection in markdown. Style them as references (distinct from body text), make them clickable when the workspace is in "GitHub context" (git remote auto-detect + optional setting), reuse existing link behavior and reveal-on-select. Exclude emails from mention detection; support multiple refs per paragraph and accessibility (link semantics when clickable).

## Technical Context

**Language/Version**: TypeScript (strict mode), target ES2020  
**Primary Dependencies**: VS Code Extension API, remark (existing), no new runtime deps  
**Storage**: N/A (in-memory parse cache; git remote read from workspace)  
**Testing**: Jest, existing `__tests__` layout; mock VS Code API  
**Target Platform**: VS Code (extension host)  
**Project Type**: VS Code extension (markdown inline editor)  
**Performance Goals**: Decoration computation within existing parse pass; no parse on selection change (use markdown-parse-cache); large-file safe  
**Constraints**: Parse cache always used; position-mapping for CRLF/LF; no O(n²) over document  
**Scale/Scope**: Single-document editor; typical markdown files (<10k lines); regex-based scan over normalized text

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status | Notes                                                                                                                              |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **I. Code Quality**       | Pass   | TypeScript strict; changes in `/src/` only; JSDoc for public APIs; `npm run validate` before commit                                |
| **II. Testing Standards** | Pass   | Tests in `__tests__/` next to module; cover patterns, email exclusion, context off; mock VS Code where needed                      |
| **III. UX Consistency**   | Pass   | Mention/ref styling consistent with link styling; link handling same as existing markdown links; reveal-on-select same as existing |
| **IV. Performance**       | Pass   | Mention/ref detection in same parse pass (or post-pass on cached parse); parse cache always used; no parse on selection            |

No violations. No complexity justification required.

## Project Structure

### Documentation (this feature)

```text
specs/005-mentions-references/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 (pattern + context contracts)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── parser.ts                    # Add mention/issue-ref scan; new DecorationTypes
├── parser/__tests__/            # parser-mention-ref.test.ts (or extend parser*.test.ts)
├── config.ts                    # Add mentions.enabled / mentions.linksEnabled (override)
├── decorations.ts               # MentionDecorationType, IssueReferenceDecorationType
├── decorator/
│   ├── decoration-type-registry.ts   # Register mention, issueReference
│   └── decoration-categories.ts      # Optional: add to marker set if needed
├── link-provider.ts             # Provide DocumentLinks for mention/ref when in context
├── link-click-handler.ts        # Include mention/ref in single-click when enabled
├── link-targets.ts              # Optional: extend or add resolveMentionTarget, resolveIssueRefTarget
├── forge-context.ts             # NEW: getForgeContext(workspaceRootUri), ForgeContextResult, git remote + setting
├── forge-context/__tests__/     # forge-context.test.ts
└── (existing modules unchanged except where integrating new decoration types and links)
```

**Structure Decision**: Single-project VS Code extension. New module `forge-context.ts` for context detection; parser and link-provider/click-handler extended in place; new decoration types in decorations.ts and registry.

## Complexity Tracking

Not applicable; no constitution violations.
