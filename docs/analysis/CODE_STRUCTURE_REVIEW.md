# Code Structure Review - DRY & Domain Separation

**Date:** 2025-01-27  
**Focus:** DRY principles, domain separation, helper function organization

---

## Executive Summary

The codebase has good separation in some areas (`position-mapping.ts`, `decorations.ts`) but has several DRY violations and domain mixing issues. This document identifies issues and provides recommendations for restructuring.

---

## Current Structure Analysis

### ✅ Well-Organized Files

1. **`position-mapping.ts`** - ✅ Good example
   - Single domain: Position mapping utilities
   - Helper functions: `mapNormalizedToOriginal()`, `normalizeAnchorText()`
   - Clear purpose and documentation

2. **`decorations.ts`** - ✅ Good example
   - Single domain: Decoration type factories
   - All decoration creation functions in one place
   - Clear separation of concerns

3. **`parser-remark.ts`** - ✅ Good example
   - Single domain: Remark processor initialization
   - Helper for dynamic imports
   - Clear purpose

---

## Issues Found

### 1. Text Normalization Logic Duplication

**Status:** Resolved in 2026 refactor

**Status:** 🔴 High Priority  
**Location:** `src/parser.ts:124-126`, `src/parser/__tests__/helpers/crlf-helpers.ts:9-10`

**Issue:**
- CRLF → LF normalization logic is duplicated:
  - Inline in `parser.ts`: `text.indexOf('\r') !== -1 ? text.replace(/\r\n|\r/g, '\n') : text`
  - As helper in test: `normalizeToLF()` in `crlf-helpers.ts`
- Same logic, different locations

**Impact:**
- Maintenance burden (changes must be made in multiple places)
- Risk of inconsistencies
- Test helper not available to production code

**Recommendation:**
- Move `normalizeToLF()` from test helpers to `position-mapping.ts`
- Update `parser.ts` to use the utility function
- Keep test helper as a re-export or remove if redundant

**Files to Change:**
- `src/position-mapping.ts` - Add `normalizeToLF()` function
- `src/parser.ts:124-126` - Use `normalizeToLF()` instead of inline logic
- `src/parser/__tests__/helpers/crlf-helpers.ts` - Re-export or remove

---

### 2. Configuration Reading Duplication

**Status:** Resolved in 2026 refactor

**Status:** 🔴 High Priority  
**Location:** `src/extension.ts:11-24`, `src/link-provider.ts:30-31`

**Issue:**
- Configuration reading is duplicated:
  - `getDiffViewApplyDecorationsSetting()` in `extension.ts`
  - Direct `getConfiguration()` call in `link-provider.ts`
- Same configuration key accessed in multiple places

**Impact:**
- Configuration key changes require updates in multiple files
- Risk of typos or inconsistencies
- No single source of truth for configuration

**Recommendation:**
- Create `src/config.ts` or `src/settings.ts` utility file
- Centralize all configuration reading
- Export typed configuration getters

**Example Structure:**
```typescript
// src/config.ts
export function getDiffViewApplyDecorations(): boolean {
  const config = vscode.workspace.getConfiguration('markdownInlineEditor');
  return config.get<boolean>('defaultBehaviors.diffView.applyDecorations', false);
}
```

**Files to Change:**
- Create `src/config.ts`
- Update `src/extension.ts` to import from `config.ts`
- Update `src/link-provider.ts` to import from `config.ts`

---

### 3. Diff Detection Logic Duplication

**Status:** Resolved in 2026 refactor

**Status:** 🟡 Medium Priority  
**Location:** `src/decorator.ts:422-499`, `src/link-provider.ts:35-36`

**Issue:**
- Diff detection logic is duplicated:
  - `DIFF_SCHEMES` constant in `decorator.ts:422`
  - `isEditorInDiffContext()` in `decorator.ts:431`
  - `isDiffEditor()` in `decorator.ts:478`
  - Similar `diffSchemes` array in `link-provider.ts:35-36`

**Impact:**
- Duplicated constants (DIFF_SCHEMES vs diffSchemes)
- Complex diff detection logic only in decorator, not reusable
- Link provider has simplified version that may miss edge cases

**Recommendation:**
- Create `src/editor-utils.ts` or `src/diff-detection.ts` helper file
- Extract diff detection utilities
- Share between decorator and link provider

**Example Structure:**
```typescript
// src/editor-utils.ts
export const DIFF_SCHEMES: readonly string[] = ['git', 'vscode-merge', 'vscode-diff'];

export function isEditorInDiffContext(editor: TextEditor): boolean {
  // ... existing logic from decorator.ts
}

export function isDiffEditor(editor: TextEditor): boolean {
  // ... existing logic from decorator.ts
}
```

**Files to Change:**
- Create `src/editor-utils.ts`
- Move diff detection logic from `decorator.ts`
- Update `decorator.ts` to import from `editor-utils.ts`
- Update `link-provider.ts` to use shared utilities

---

### 4. URL Resolution Logic Complexity

**Status:** Resolved in 2026 refactor

**Status:** 🟡 Medium Priority  
**Location:** `src/link-provider.ts:62-75`

**Issue:**
- Complex URL resolution logic embedded in link provider
- Logic could be reused elsewhere (e.g., hover providers, command handlers)
- Mixes URL parsing with link provider concerns

**Impact:**
- Hard to test URL resolution in isolation
- Not reusable for other features
- Link provider file mixes concerns

**Recommendation:**
- Create `src/url-utils.ts` helper file
- Extract URL resolution logic
- Make it a pure function for easy testing

**Example Structure:**
```typescript
// src/url-utils.ts
export function resolveLinkTarget(url: string, documentUri: vscode.Uri): vscode.Uri | undefined {
  if (url.startsWith('#')) {
    // Internal anchor link
    const anchor = url.substring(1);
    return vscode.Uri.parse(`command:markdown-inline-editor.navigateToAnchor?${encodeURIComponent(JSON.stringify([anchor, documentUri.toString()]))}`);
  } else if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
    // External URL
    return vscode.Uri.parse(url);
  } else if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    // Relative file path
    return vscode.Uri.joinPath(documentUri, '..', url);
  } else {
    // Try to resolve as relative path
    return vscode.Uri.joinPath(documentUri, '..', url);
  }
}
```

**Files to Change:**
- Create `src/url-utils.ts`
- Extract logic from `link-provider.ts:62-75`
- Update `link-provider.ts` to use utility

---

### 5. Extension.ts Domain Mixing

**Status:** Resolved in 2026 refactor

**Status:** 🟡 Medium Priority  
**Location:** `src/extension.ts`

**Issue:**
- `extension.ts` mixes multiple concerns:
  - Configuration reading (lines 11-24)
  - Command registration (lines 64-106)
  - Event handler registration (lines 108-137)
  - Navigation logic (lines 77-105 - anchor finding)

**Impact:**
- File is doing too much (164 lines, multiple responsibilities)
  - Extension activation
  - Configuration management
  - Command handlers
  - Navigation logic
- Hard to test individual concerns
- Violates single responsibility principle

**Recommendation:**
- Extract command handlers to separate files:
  - `src/commands/toggle-decorations.ts` - Toggle command
  - `src/commands/navigate-to-anchor.ts` - Anchor navigation
- Extract configuration to `src/config.ts` (see issue #2)
- Keep `extension.ts` as thin orchestrator

**Example Structure:**
```typescript
// src/commands/navigate-to-anchor.ts
export function createNavigateToAnchorCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    'markdown-inline-editor.navigateToAnchor',
    async (anchor: string, documentUri: string) => {
      // ... navigation logic
    }
  );
}

// src/extension.ts (simplified)
export function activate(context: vscode.ExtensionContext) {
  const decorator = new Decorator();
  // ... setup
  
  context.subscriptions.push(createToggleDecorationsCommand());
  context.subscriptions.push(createNavigateToAnchorCommand());
  // ... event handlers
}
```

**Files to Change:**
- Create `src/commands/` directory
- Extract command handlers
- Simplify `extension.ts` to orchestration only

---

### 6. Parser.ts Helper Methods

**Status:** Resolved in 2026 refactor

**Status:** 🟢 Low Priority  
**Location:** `src/parser.ts:249-269`

**Issue:**
- `addMarkerDecorations()` is a helper method within parser class
- Could be extracted as a pure utility function
- Currently tightly coupled to parser class

**Impact:**
- Minor: Method is only used within parser
- Could be more testable as pure function
- Not a critical issue

**Recommendation:**
- Consider extracting to `src/parser-utils.ts` if parser grows
- Keep as-is for now (only used internally)
- Revisit if parser class becomes too large

**Files to Change:**
- None (low priority, monitor for growth)

---

### 7. Performance Constants Location

**Status:** 🟢 Low Priority  
**Location:** `src/decorator.ts:33-40`

**Issue:**
- `PERFORMANCE_CONSTANTS` defined in decorator class file
- Could be in separate config/constants file
- Only used by decorator currently

**Impact:**
- Minor: Constants are well-organized
- Could be shared if other classes need them
- Not a critical issue

**Recommendation:**
- Consider moving to `src/config.ts` if constants need to be shared
- Keep as-is if decorator-specific
- Revisit if constants are needed elsewhere

**Files to Change:**
- None (low priority, monitor for reuse)

---

## Recommended File Structure

### Current Structure
```
src/
├── extension.ts          (164 lines - multiple concerns)
├── decorator.ts          (932 lines - large class)
├── parser.ts             (1137 lines - large class)
├── link-provider.ts      (103 lines)
├── decorations.ts        (291 lines - ✅ good)
├── position-mapping.ts   (100 lines - ✅ good)
└── parser-remark.ts      (55 lines - ✅ good)
```

### Recommended Structure
```
src/
├── extension.ts              (orchestration only)
├── config.ts                 (NEW - configuration utilities)
├── editor-utils.ts           (NEW - diff detection, editor checks)
├── url-utils.ts              (NEW - URL resolution)
├── text-utils.ts             (NEW - text normalization, or merge into position-mapping.ts)
├── commands/
│   ├── toggle-decorations.ts (NEW)
│   └── navigate-to-anchor.ts (NEW)
├── decorator.ts              (simplified)
├── parser.ts                 (simplified - uses text-utils)
├── link-provider.ts          (simplified - uses config, editor-utils, url-utils)
├── decorations.ts            (✅ keep as-is)
├── position-mapping.ts       (✅ keep as-is, add normalizeToLF)
└── parser-remark.ts          (✅ keep as-is)
```

---

## Implementation Priority

### Phase 1: High Priority (DRY Violations)
1. ✅ Extract text normalization to `position-mapping.ts`
2. ✅ Extract configuration reading to `config.ts`
3. ✅ Extract diff detection to `editor-utils.ts`

### Phase 2: Medium Priority (Domain Separation)
4. Extract URL resolution to `url-utils.ts`
5. Extract command handlers to `commands/` directory
6. Simplify `extension.ts` to orchestration only

### Phase 3: Low Priority (Code Organization)
7. Monitor parser helper methods
8. Monitor performance constants location

---

## Benefits of Refactoring

1. **DRY Compliance**
   - Single source of truth for each utility
   - No duplicated logic
   - Easier maintenance

2. **Domain Separation**
   - Each file has single, clear purpose
   - Easier to understand and navigate
   - Better testability

3. **Reusability**
   - Utilities can be shared across modules
   - Easier to add new features
   - Better code organization

4. **Testability**
   - Pure utility functions easier to test
   - Isolated concerns
   - Better test coverage

---

## Notes

- **Incremental Refactoring:** Refactor incrementally, one issue at a time
- **Test Coverage:** Ensure tests pass after each refactoring step
- **Backward Compatibility:** Maintain public APIs during refactoring
- **Documentation:** Update JSDoc and README as structure changes

---

## References

- [AGENTS.md](../AGENTS.md) - Project guidelines
- [runtime-pipeline.md](../architecture/runtime-pipeline.md) - Current runtime boundaries after the refactor
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
