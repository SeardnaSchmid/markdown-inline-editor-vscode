# AI Agent Guide for Markdown Inline Editor

This document provides essential context and guidelines for AI agents working on this VS Code extension project. Follow these instructions to ensure your contributions align with project standards.

## Quick Start Checklist

Before making changes:
1. ✅ Read this file completely
2. ✅ Understand the project structure (see below)
3. ✅ Run `npm run validate` to ensure current state is clean
4. ✅ Identify the correct files to modify in `/src/`
5. ✅ Write/update tests in corresponding `__tests__/` directories
6. ✅ Verify changes with `npm run validate` before committing

## Project Context

**What This Project Does:**
- VS Code extension that renders markdown syntax inline (WYSIWYG-style)
- Uses VS Code TextEditorDecorationType to hide/show markdown syntax
- Parses markdown using remark and applies visual decorations
- Supports links, images, headings, lists, code blocks, and more

**Tech Stack:**
- TypeScript (strict mode)
- VS Code Extension API
- [remark](https://github.com/remarkjs/remark) for markdown parsing
- Vitest for testing
- esbuild for bundling

## Project Structure

### Source Code (`/src/`)

**Core Files:**
- `extension.ts` - Extension entry point, activation, command registration
- `config.ts` - Centralized configuration access (VS Code settings)
- `parser.ts` - Stable parser facade exporting parser API and shared parser types
- `parser/core.ts` - Main markdown parser implementation, converts AST to decoration ranges
- `parser/types.ts` - Shared parser result and decoration type definitions
- `parser-remark.ts` - Remark parser setup and utilities
- `decorations.ts` - Decoration type factories (transparent, faint, etc.)
- `decorator.ts` - Decoration orchestration facade, coordinates parsing and application

**Specialized Modules:**
- `diff-context.ts` - Detects diff views and applies policies
- `link-targets.ts` - Resolves link/image URLs (relative, absolute, workspace)
- `link-interactions/shared.ts` - Shared link target/range resolution used by provider, hover, and click flows
- `markdown-parse-cache.ts` - Caching layer for parsed markdown (performance critical)
- `position-mapping.ts` - Handles CRLF/LF normalization for position calculations
- `language-support.ts` - Shared list of supported markdown-like language IDs and document selectors

**Feature Modules:**
- `link-provider.ts` - Makes links clickable (DocumentLinkProvider)
- `link-hover-provider.ts` - Shows link URLs on hover
- `image-hover-provider.ts` - Shows image previews on hover
- `link-click-handler.ts` - Handles single-click navigation
- `commands/` - User-facing command registrations and implementations
- `registration/` - Provider and event-wiring helpers used by `extension.ts`

**Decoration System:**
- `decorator/decoration-type-registry.ts` - Manages decoration type lifecycle
- `decorator/visibility-model.ts` - 3-state filtering (Rendered/Ghost/Raw)
- `decorator/checkbox-toggle.ts` - Handles checkbox clicks
- `decorator/decoration-categories.ts` - Categorizes decoration types
- `decorator/file-decoration-state.ts` - Persists and migrates per-file enable/disable state
- `decorator/update-scheduler.ts` - Debounced and idle update scheduling
- `decorator/editor-decoration-applier.ts` - Range creation, scope entry building, and decoration application helpers
- `decorator/mermaid-update-coordinator.ts` - Async Mermaid rendering and decoration coordination

**Test Directories:**
- Each module has a corresponding `__tests__/` directory
- Test files use `.test.ts` extension
- Follow naming: `module-name.test.ts`

### Other Directories

- `/dist/` - Compiled output (DO NOT EDIT - generated files)
- `/docs/` - Documentation, feature specs, analysis
- `/scripts/` - Build and release automation
- `/assets/` - Icons and static files

## Available Commands

**Build & Development:**
```bash
npm run compile    # TypeScript compilation only
npm run build   # Full build (compile + bundle + package)
npm run clean   # Remove build artifacts
npm run package # Package extension as .vsix
```

**Testing (Vitest):**
```bash
npm test              # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run test:crlf     # Run CRLF-specific tests
```

**Validation:**
```bash
npm run lint          # Run ESLint
npm run lint:docs     # Validate feature file structure
npm run validate      # Run ALL checks (lint:docs + test + build)
```

**Release:**
```bash
npm run release       # Automated release (see Release section)
```

## Critical Rules for AI Agents

### 1. File Modification Boundaries

**✅ DO:**
- Modify files in `/src/` only
- Edit test files in `*/__tests__/` directories
- Update documentation in `/docs/` when adding features
- Modify `package.json` only for dependencies or scripts

**❌ DO NOT:**
- Edit files in `/dist/` (generated, will be overwritten)
- Modify `.vscodeignore` unless explicitly asked
- Change build configuration without understanding impact
- Edit `CHANGELOG.md` manually (auto-generated)

### 2. Performance Requirements

**Cache Usage:**
- ALWAYS use `markdown-parse-cache.ts` for parsing
- NEVER parse the entire document on selection change
- Cache results and reuse when possible

**Large File Handling:**
- Handle malformed markdown gracefully (don't crash)
- Test with large files (>10k lines) if making parser changes
- Use efficient algorithms (avoid O(n²) operations)

### 3. Testing Requirements

**Before Committing:**
1. Write tests for new functionality
2. Update existing tests if behavior changes
3. Run `npm test` and ensure all pass
4. Check test coverage if adding new modules

**Test Structure:**
- Place tests in `src/module-name/__tests__/module-name.test.ts`
- Use descriptive test names: `describe('feature', () => { it('should do X', ...) })`
- Test edge cases: empty input, malformed markdown, large files
- Mock VS Code API when needed (see existing tests for patterns)

**Current Test Coverage:**
- 770+ passing tests across 60+ test files (parser, hover providers, click handler, decorator, and more)
- Maintain or improve this coverage

### 4. Code Style

**TypeScript:**
- Use strict mode (enforced by tsconfig)
- Prefer interfaces and unions over `any`
- Add JSDoc comments to public methods
- Use meaningful, descriptive names

**Naming Conventions:**
- Classes: `PascalCase` (e.g., `MarkdownParser`)
- Functions: `camelCase` (e.g., `parseMarkdown`)
- Test files: `kebab-case.test.ts` (e.g., `link-provider.test.ts`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_CACHE_SIZE`)

**Code Organization:**
- Keep functions focused and single-purpose
- Extract complex logic into helper functions
- Group related functionality in modules
- Follow existing patterns in the codebase

### 5. Git Workflow

**Commit Messages (REQUIRED):**
All commits MUST follow [Conventional Commits](https://www.conventionalcommits.org/):

Format: `<type>(<scope>): <description>`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Test additions/changes
- `chore` - Maintenance tasks

**Examples:**
```
feat(parser): add support for task lists
fix(decorator): cache decorations on selection change
perf(parser): optimize ancestor chain building
docs: update performance improvements roadmap
test(link-provider): add tests for relative link resolution
```

**Branch Strategy:**
- Use feature branches: `feat/feature-name` or `fix/bug-name`
- Keep PRs focused (one feature/fix per PR)
- Reference related issues/PRs in commit messages

### 6. Validation Before Committing

**Always Run:**
```bash
npm run validate
```

This runs:
1. `npm run lint:docs` - Validates feature file structure
2. `npm test` - Runs all tests
3. `npm run build` - Ensures code compiles and bundles

**If Validation Fails:**
- Fix linting errors first
- Fix failing tests
- Ensure code compiles
- DO NOT commit until all checks pass

## Common Tasks & Patterns

### Adding a New Markdown Feature

1. **Understand the feature:**
   - Check `/docs/features/` for feature specifications
   - Review similar features in the codebase

2. **Modify parser:**
   - Update `parser.ts` to detect the new markdown syntax
   - Add decoration ranges for the new feature
   - Follow existing patterns (see headings, links, etc.)

3. **Add decorations:**
   - Update `decorations.ts` if new decoration types needed
   - Register in `decoration-type-registry.ts`

4. **Update tests:**
   - Add test cases in `src/parser/__tests__/`
   - Test edge cases and malformed input

5. **Validate:**
   - Run `npm run validate`
   - Test manually in VS Code if possible

### Fixing a Bug

1. **Reproduce:**
   - Understand the bug from issue/description
   - Create a test case that reproduces it

2. **Fix:**
   - Identify the root cause
   - Make minimal changes to fix
   - Follow existing code patterns

3. **Test:**
   - Add/update tests to prevent regression
   - Run `npm test` to ensure all pass

4. **Validate:**
   - Run `npm run validate`
   - Verify fix works as expected

### Refactoring Code

1. **Plan:**
   - Understand current implementation
   - Identify what needs to change
   - Ensure tests exist (add if missing)

2. **Refactor:**
   - Make incremental changes
   - Keep tests passing throughout
   - Maintain same functionality

3. **Verify:**
   - Run `npm run validate`
   - Ensure no performance regression

## Release Process

**For AI Agents:** You typically won't create releases, but understand the process:

1. **Prerequisites:**
   - All changes committed
   - On `main` branch
   - Clean working tree
   - All commits follow Conventional Commits

2. **Run Release:**
   ```bash
   npm run release
   ```

3. **What Happens:**
   - Validates environment and runs all checks
   - Determines version from commits (SemVer)
   - Generates CHANGELOG.md
   - Updates package.json version
   - Commits and tags release

4. **Push (CRITICAL - Tags MUST be pushed):**
   ```bash
   git push origin main --follow-tags
   ```
   
   **⚠️ IMPORTANT:** The `--follow-tags` flag is essential! Without it, tags won't be pushed and releases won't be processed by CI/CD.
   
   **Verify tags were pushed:**
   ```bash
   git ls-remote --tags origin | grep v<version>
   ```
   
   If tags are missing, push them explicitly:
   ```bash
   git push origin v<version>
   ```

5. **CI/CD:**
   - GitHub Actions automatically publishes to VS Code Marketplace and OpenVSX
   - **Releases only process if tags are pushed to remote**
   - Check GitHub Actions to verify release jobs ran successfully

See `docs/release-generation.md` for detailed documentation.

## Important Patterns to Follow

### Using the Parse Cache

```typescript
// ✅ CORRECT: Use cache
const ast = markdownParseCache.getOrParse(document);

// ❌ WRONG: Parse directly
const ast = remark().parse(document.getText());
```

### Handling Positions

```typescript
// ✅ CORRECT: Use position mapping for CRLF/LF
const mappedPosition = positionMapping.mapToDocument(
  document,
  line,
  character
);

// ❌ WRONG: Use positions directly without mapping
const range = new vscode.Range(line, char, line, char);
```

### Creating Decorations

```typescript
// ✅ CORRECT: Use decoration factories
const decoration = decorations.createTransparent();

// ❌ WRONG: Create decoration types directly
const decoration = vscode.window.createTextEditorDecorationType({...});
```

### Error Handling

```typescript
// ✅ CORRECT: Handle errors gracefully
try {
  const ast = parseMarkdown(text);
} catch (error) {
  // Log but don't crash
  console.error('Parse error:', error);
  return []; // Return empty decorations
}

// ❌ WRONG: Let errors propagate
const ast = parseMarkdown(text); // May throw
```

## Anti-Patterns to Avoid

1. **Parsing on every change:**
   - ❌ Don't parse the entire document on selection change
   - ✅ Use cache and parse only when document changes

2. **Ignoring CRLF/LF:**
   - ❌ Don't use positions without mapping
   - ✅ Always use position mapping utilities

3. **Hardcoding paths:**
   - ❌ Don't hardcode file paths or URLs
   - ✅ Use `link-targets.ts` for resolution

4. **Skipping tests:**
   - ❌ Don't commit without tests
   - ✅ Always write/update tests

5. **Breaking existing functionality:**
   - ❌ Don't change behavior without updating tests
   - ✅ Maintain backward compatibility when possible

## Definition of Done

Before considering a task complete:

- [ ] Code compiles without errors (`npm run compile`)
- [ ] All tests pass (`npm test`)
- [ ] Tests added/updated for new/changed functionality
- [ ] Code follows style guidelines (lint passes)
- [ ] Documentation updated if needed
- [ ] Validation passes (`npm run validate`)
- [ ] Commit message follows Conventional Commits
- [ ] Changes are minimal and focused

## Getting Help

**When Stuck:**
1. Review existing similar code in the codebase
2. Check test files for usage examples
3. Read documentation in `/docs/`
4. Review feature specifications in `/docs/features/`

**Key Files to Read:**
- `src/parser.ts` - Understand how markdown is parsed
- `src/decorator.ts` - Understand how decorations are applied
- `src/markdown-parse-cache.ts` - Understand caching strategy
- Test files - See examples of how modules are used

## Quick Reference

**Most Common Commands:**
```bash
npm run validate  # Run all checks before committing
npm test          # Run tests
npm run build     # Build extension
npm run lint      # Check code style
```

**File Locations:**
- Source code: `/src/`
- Tests: `/src/*/__tests__/`
- Documentation: `/docs/`
- Build output: `/dist/` (don't edit)

**Commit Format:**
```
<type>(<scope>): <description>

Examples:
feat(parser): add support for task lists
fix(decorator): cache decorations on selection change
```

---

**Remember:** When in doubt, follow existing patterns in the codebase. The codebase is well-structured and consistent - use it as a guide.
