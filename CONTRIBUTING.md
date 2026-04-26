# Contributing to Markdown Inline Editor

Thank you for your interest in contributing! This guide covers the workflow and conventions specific to this project.

**Quick Start:** See the [README](README.md#getting-started-developers) for setup instructions.

## Development Workflow

### 1. Create a Feature Branch

Always work on a feature branch, never directly on `main`:

```bash
git checkout -b feat/my-feature
# or
git checkout -b fix/bug-description
```

**Branch naming conventions:**
- `feat/` - New features
- `fix/` - Bug fixes
- `perf/` - Performance improvements
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

### 2. Make Your Changes

- **Edit only files in `src/`** - Never modify `dist/` directly
- **Follow TypeScript strict mode** - Use interfaces/unions, avoid `any`
- **Add JSDoc comments** for public methods and complex logic
- **Write tests** for new functionality (see Testing section below)

### 3. Code Style Guidelines

**Naming Conventions:**
- **Classes**: PascalCase (`MarkdownParser`, `Decorator`)
- **Functions/Methods**: camelCase (`extractDecorations`, `updateDecorations`)
- **Test files**: kebab-case (`parser-bold.test.ts`, `parser-edge-cases.test.ts`)
- **Constants**: UPPER_SNAKE_CASE or camelCase depending on context

**TypeScript Best Practices:**
- Use interfaces for object shapes
- Prefer union types over `any`
- Add type annotations for function parameters and return types
- Use optional chaining (`?.`) and nullish coalescing (`??`) where appropriate

**Example:**
```typescript
/**
 * Extracts decoration ranges from markdown text.
 * 
 * @param {string} text - The markdown text to parse
 * @returns {DecorationRange[]} Array of decoration ranges, sorted by startPos
 */
extractDecorations(text: string): DecorationRange[] {
  // Implementation
}
```

### 4. Testing

**All changes must include tests.** The project uses Vitest for testing with **770+ passing tests** across 60+ test files.

**Run tests:**
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
```

**Test file locations:**
- Parser tests: `src/parser/__tests__/`
- Parse cache tests: `src/markdown-parse-cache/__tests__/`
- Diff context tests: `src/diff-context/__tests__/`
- Link target tests: `src/link-targets/__tests__/`
- Link provider tests: `src/link-provider/__tests__/`
- Image hover provider tests: `src/image-hover-provider/__tests__/`
- Link hover provider tests: `src/link-hover-provider/__tests__/`
- Link click handler tests: `src/link-click-handler/__tests__/`

Follow existing test patterns and naming conventions (kebab-case for test files).

**Test requirements:**
- ✅ All existing tests must pass
- ✅ New features need test coverage
- ✅ Edge cases should be tested
- ✅ Performance-critical paths should have benchmarks
- ✅ Provider classes should test ESM module loading (use `MarkdownParser.create()` in tests)

**Example test structure:**
```typescript
describe('MarkdownParser', () => {
  describe('extractDecorations', () => {
    it('should parse bold text', async () => {
      const parser = await MarkdownParser.create();
      const decorations = parser.extractDecorations('**bold**');
      // Assertions
    });
  });
});
```

**E2E tests** run the extension inside a real editor instance and cover activation, decoration rendering, providers, and Mermaid diagram processing.

```bash
npm run test:e2e         # Run e2e tests in VS Code (auto-downloaded)
npm run test:e2e:cursor  # Run e2e tests in your local Cursor install
```

The Cursor variant requires Cursor to be installed. It auto-detects the default install path per platform, or you can override it:

```bash
CURSOR_EXECUTABLE_PATH=/custom/path/Cursor npm run test:e2e:cursor
```

> **Note:** Cursor e2e tests are for local development only — CI always runs against VS Code.

### 5. Linting and Type Checking

Before committing, ensure your code passes linting and type checking:

```bash
npm run lint           # Check code style
npm run compile        # Type check and compile
npm run lint:docs      # Validate feature file outlines (if editing docs/features/)
```

**Fix linting issues:**
- Most issues can be auto-fixed with your editor's ESLint integration
- Follow the project's ESLint configuration

**Feature File Validation:**
If you're editing files in `docs/features/`, you must ensure they follow the correct outline structure:
- YAML frontmatter with `status`, `updateDate`, and `priority`
- H1 title
- Required H2 sections in order: Overview, Implementation, Acceptance Criteria, Notes, Examples
- Run `npm run lint:docs` to validate all feature files

### 6. Commit Your Changes

**Use Conventional Commits** format for all commit messages:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Commit Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Test additions or changes
- `chore` - Build process or auxiliary tool changes

**Examples:**
```bash
git commit -m "feat(parser): add support for definition lists"
git commit -m "fix(decorator): cache decorations on selection change"
git commit -m "perf(parser): optimize ancestor chain building"
git commit -m "docs: update performance improvements roadmap"
git commit -m "test(parser): add edge case tests for nested formatting"
```

**Scope** (optional but recommended):
- `parser` - Changes to markdown parsing
- `decorator` - Changes to decoration management
- `extension` - Changes to extension activation/entry point
- `docs` - Documentation updates

### 7. Performance Considerations

This extension prioritizes performance, especially for:
- **Selection changes** - Should be instant (uses cached decorations)
- **Document edits** - Should feel responsive during rapid typing
- **Large documents** - Should remain usable (files over 1MB may experience slower parsing)

**Before submitting performance-related changes:**
- Ensure no performance regressions
- Consider adding benchmarks for significant changes

**Key performance principles:**
- Never parse the whole document on selection change (use cache)
- Use efficient data structures (Maps, Sets)
- Avoid unnecessary string allocations
- Batch operations where possible

### 8. Pull Request Process

1. **Push your branch:**
   ```bash
   git push origin feat/my-feature
   ```

2. **Create a Pull Request** on GitHub:
   - Provide a clear title and description
   - Reference any related issues (e.g., "Fixes #123")
   - Include screenshots/GIFs for UI changes if applicable

3. **PR Requirements:**
   - ✅ All tests pass (`npm test`)
   - ✅ Code compiles without errors (`npm run compile`)
   - ✅ Linting passes (`npm run lint`)
   - ✅ Feature file validation passes (`npm run lint:docs`) - if editing `docs/features/`
   - ✅ No performance regressions
   - ✅ Documentation updated if needed
   - ✅ Follows Conventional Commits

4. **Code Review:**
   - Address review feedback promptly
   - Keep PRs focused and reasonably sized
   - Respond to comments and questions

5. **After Approval:**
   - Maintainers will merge your PR
   - Your contribution will be included in the next release!

## Common Development Tasks

### Adding a New Markdown Feature

1. **Update the parser** (`src/parser.ts`):
   - Add a new case in `processAST()` switch statement
   - Implement the processing method (e.g., `processDefinitionList()`)
   - Extract decoration ranges

2. **Add decoration type** (`src/decorations.ts`):
   - Create a new decoration type factory if needed
   - Register it in `decorator/decoration-type-registry.ts`

3. **Write tests** (in appropriate `*/__tests__/` directory):
   - Create or update test file in the relevant test directory
   - Test various edge cases
   - For providers using `MarkdownParser`, use `MarkdownParser.create()` and replace the parser after instantiation

4. **Update documentation:**
   - Update README.md if it's a user-facing feature
   - Update AGENTS.md if it affects architecture
   - If editing feature files in `docs/features/`, ensure they pass validation (`npm run lint:docs`)

### Debugging

**Enable debug logging:**
- Check `View → Output → Extension Host` for extension logs
- Use `console.log()` sparingly (remove before committing)

**Common issues:**
- **Decorations not showing**: Check if file is `.md`
- **Extension not activating**: Check activation events in `package.json`
- **Performance issues**: Profile with VS Code's built-in tools

## Documentation

When contributing, please update relevant documentation:

- **README.md** - User-facing features, installation, usage
- **AGENTS.md** - Architecture and development guidelines
- **CONTRIBUTING.md** - This file (if workflow changes)
- **FAQ.md** - Common issues and solutions (if user-facing changes)
- **Code comments** - JSDoc for public APIs

### Feature File Structure

Files in `docs/features/` must follow a specific outline structure. The validation script (`npm run lint:docs`) enforces:

1. **YAML Frontmatter** (required):
   ```yaml
   ---
   status: ✅ Implemented
   updateDate: 2024-12-19
   priority: Core Feature
   ---
   ```

2. **Required Sections** (in order):
   - `# Title` (H1 - exactly one)
   - `## Overview` (H2)
   - `## Implementation` (H2)
   - `## Acceptance Criteria` (H2 - with Gherkin scenarios)
   - `## Notes` (H2)
   - `## Examples` (H2)

3. **Validation:**
   - Run `npm run lint:docs` before committing changes to feature files
   - The script validates frontmatter fields, heading structure, and section order
   - Headings inside code blocks are automatically ignored

**Example structure:**
```markdown
---
status: ✅ Implemented
updateDate: 2024-12-19
priority: Core Feature
---

# Feature Name

## Overview

Brief description of the feature.

## Implementation

How the feature works.

## Acceptance Criteria

### Basic Functionality
```gherkin
Feature: Feature name
  Scenario: Basic case
    When I type <markdown>
    Then the expected behavior occurs
```

## Notes

- Additional context
- Requirements

## Examples

- `markdown` → rendered output
```

## Getting Help

- **Open an issue** for bugs or feature requests
- **Check existing issues** before creating new ones
- **Review README.md** for high-level architecture overview
- **Read the code** - The codebase is well-documented

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on what's best for the project

## Recognition

Contributors will be credited in:
- Release notes
- GitHub contributors page
- Project documentation (where appropriate)

Thank you for contributing to Markdown Inline Editor! 🎉
