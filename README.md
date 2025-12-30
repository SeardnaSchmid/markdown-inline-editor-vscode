# Markdown Inline Editor [![CI/CD Status][ci-img]][ci] [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.txt)

<img src="assets/icon.png" align="right" alt="Extension Icon" width="120" height="120">

**Write Markdown like a rich text editor** – see **bold**, *italic*, and `code` styled inline while syntax markers stay hidden. Click to edit raw Markdown. Your files remain 100% standard `.md`.

**Why?** Less clutter, more focus. Git-friendly. Works everywhere.

## ✨ Key Features

* **Hide syntax** – No more `**`, `~~`, backticks cluttering your view
* **Smart reveal** – Decorations automatically hide around cursor/selection to show raw Markdown  
* **Heading support** – Click on headings to see `#` markers and normal font size while editing
* **Fast** – Intelligent caching, no lag on selection changes
* **Compatible** – Standard `.md` files, works with any tool
* **Theme-aware** – Automatically adapts to your VS Code theme
* **Configurable** – Customize cursor-based decoration hiding behavior

## Demo

<p align="center" style="max-width:95%; margin-left:auto; margin-right:auto;">
  <img src="assets/demo.gif" alt="Markdown Inline Editor Demo" width="95%"><br>
  <span style="display:block; font-size:90%; color:#888; margin-top:8px;">
    <em>Figure: Interactive demo—see formatting applied inline, reveal raw Markdown with a click, and watch the extension adapt instantly to color theme changes.</em>
  </span>
</p>
<p align="center">
  <img src="assets/example-ui.png" alt="Markdown Inline Editor - formatted view" width="47%">
  <img src="assets/example-ui-selected-line.png" alt="Raw Markdown revealed on selection" width="47%">
</p>
<p align="center">
  <em style="font-size:90%; color:#888;">Left: Markdown as rendered—formatting is shown inline, raw syntax markers are hidden for clarity.</em><br>
  <em style="font-size:90%; color:#888;">Right: Selecting a line reveals the original Markdown syntax for direct editing.</em>
</p>

## What You Get

- **Hidden syntax** – `**bold**`, `*italic*`, `~~strike~~` → see the formatting, not the markers
- **Styled headings** – `# H1` through `###### H6` sized appropriately (200% to 80% font size)
- **Clean links** – `[text](url)` → clickable text, URL hidden
- **Visual lists** – `- item` → • item (unordered lists)
- **Code blocks** – Fences hidden, background styled with theme colors
- **Blockquotes** – `> quote` → │ quote (visual bar indicator)
- **Horizontal rules** – `---` → ─────── (visual separator)
- **Smart editing** – Decorations automatically hide around cursor/selection to reveal raw Markdown
- **Heading support** – Click on headings to reveal `#` markers and return to normal font size
- **Fast performance** – Intelligent caching + incremental updates
- **Toggle anytime** – Toolbar button to enable/disable

## Recommended additional Extensions

Enhance your Markdown workflow with these complementary extensions:

- **[Markdown All in One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one)**
    - Keyboard shortcuts (e.g., <kbd>Alt</kbd>+<kbd>C</kbd> to toggle checkboxes)
    - Auto-formatting
    - Table of contents generator
    - Markdown preview
    - Many more productivity features

- **[Mermaid Chart](https://marketplace.visualstudio.com/items?itemName=MermaidChart.vscode-mermaid-chart)**
    - Create and edit diagrams directly within Markdown
    - Preview and quickly iterate on charts
    - Great for including diagram context for AI/colleagues


## Install

**VS Code Marketplace:**
- [Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=CodeSmith.markdown-inline-editor-vscode)
- Or: Extensions → Search "Markdown Inline Editor" → Install

**Quick Open:**  
Press `Ctrl+P` / `Cmd+P`, type `ext install CodeSmith.markdown-inline-editor-vscode`

## Usage

1. Open any `.md` file
2. Start typing—formatting is automatic
3. Click/select text to reveal raw Markdown
4. Use the toolbar button to toggle decorations on/off

## Supported Features

### Markdown Syntax

- [x] **Bold** – `**text**` → **text** (markers hidden)
- [x] **Italic** – `*text*` → *text* (markers hidden)
- [x] **Bold + Italic** – `***text***` → ***text*** (markers hidden)
- [x] **Strikethrough** – `~~text~~` → ~~text~~ (markers hidden)
- [x] **Inline Code** – `` `code` `` → `code` (monospace)
- [x] **Headings** – `# H1` ... `###### H6` → Sized text (200% to 80%)
- [x] **Links** – `[text](url)` → Ctrl Clickable, URL hidden
- [x] **Images** – `![alt](img.png)` → Alt text styled
- [x] **Unordered Lists** – `- item` or `* item` or `+ item` → • item
- [x] **Task Lists** – `- [ ]` / `- [x]` → ☐ / ☑
  - Supports ordered lists (`1. [ ] task`), asterisk/plus variants (`* [ ] task`, `+ [ ] task`)
  - Click checkbox to toggle, click elsewhere to see raw Markdown
  - Handles edge cases (missing spaces, invalid syntax)
- [x] **Blockquotes** – `> quote` → │ quote (visual bar)
- [x] **Nested Blockquotes** – `> > nested` → │ │ nested
- [x] **Horizontal Rules** – `---` or `***` or `___` → ─────── (visual separator)
- [x] **Code Blocks** – ` ```lang ` → Background styled, fences hidden

### Editing Features

- [x] **Cursor-based raw code display** – Decorations automatically hide around cursor/selection to reveal raw Markdown
- [x] **Heading editing** – Click on headings to see `#` markers and normal font size
- [x] **Smart checkbox handling** – Click checkbox to toggle, click elsewhere on line to see raw Markdown

**Nested formatting fully supported** (e.g., **bold *italic***, `**bold `code`**`).

## Upcoming Features

We're continuously improving the extension! Here's what's coming next:

### Critical Priority (Current focus)
- [ ] **Ordered List Auto-Numbering** – Hide markers and show auto-numbered items (1, 2, 3...), including support for nested lists
  - [ ] Hide list markers (`1.`, `2.`, etc.)
  - [ ] Show auto-numbered items (1, 2, 3...)
  - [ ] Handle nested ordered lists
  - [ ] Support GFM parentheses variant (`1)` vs `1.`)
  - [ ] Handle out-of-order numbering gracefully

### High Priority (Must have)

- [ ] **Tables** – Complete table syntax hiding with cell alignment and multi-line cell support
  - [ ] Table syntax hiding (hide `|` markers)
  - [ ] Table cell alignment support (`:---`, `:---:`, `---:`)
  - [ ] Multi-line cells (with `<br>` tags)
  - [ ] Inline formatting in cells (bold, italic, code)
  - [ ] Empty cells handling
  - [ ] Escaped pipes (`\|`) in cells
- [ ] **YAML Frontmatter** – Detect, style, and hide frontmatter delimiters
  - [ ] Detect YAML frontmatter at document start
  - [ ] Style frontmatter block (background color, distinct appearance)
  - [ ] Hide frontmatter delimiters (`---`)
  - [ ] Display as code blocks or at least to some degree as visual distinct
  - [ ] Support frontmatter editing (reveal on selection)
- [ ] **Autolinks** – Automatic link detection for `<https://...>` URLs and `<email@example.com>` email addresses
  - [ ] URL autolinks (`<https://...>`)
  - [ ] Email autolinks (`<email@example.com>`)
- [ ] **Mentions/References** – GitHub-style `@username` and `#123` references with proper styling
  - [ ] GitHub-style mentions (`@username`)
  - [ ] Issue references (`#123`)
  - [ ] Styling for mentions/references (distinct from regular text)
- [ ] **Mermaid Diagrams** – Hover or maybe inline preview for rendered Mermaid diagrams
  - [ ] Detect Mermaid code blocks (```mermaid)
  - [ ] Hover preview for rendered diagrams
  - [ ] Or inline preview (alternative approach)
  - [ ] Performance optimization
- [ ] **LaTeX/Math** – Hover or maybe inline preview for math formulas using KaTeX/MathJax
  - [ ] Detect inline math (`$...$`) and block math (`$$...$$`)
  - [ ] Hover preview for rendered math
  - [ ] Or inline preview (alternative approach)
  - [ ] Performance optimization

### Medium Priority (Extended features)

- [ ] **HTML Tags** – Detect and style HTML tags within markdown
  - [ ] Detect HTML tags
  - [ ] Style or hide HTML tags
  - [ ] Handle nested HTML structures

### Low Priority (Nice-to-Have)

- [ ] **Emoji Support** – Render emoji shortcodes like `:smile:` and `:+1:`
  - [ ] Emoji shortcode detection (`:smile:`, `:+1:`, `:tada:`)
  - [ ] Render emoji inline (or show shortcode styled)
  - [ ] Handle invalid emoji shortcodes gracefully
- [ ] **Highlighting Support** – Support `==text==` highlighting syntax with background color styling
  - [ ] Detect highlighting syntax (`==text==`)
  - [ ] Style highlighted text with background color
  - [ ] Hide highlighting markers
- [ ] **Per-File Toggle State** – Enable/disable decorations per file instead of globally
  - [ ] Per-file toggle state storage
  - [ ] UI for per-file toggle control
  - [ ] State persistence across sessions
- [ ] **Footnotes** – Support for footnote syntax `[^1]` with reference links and footnote definitions
  - [ ] Footnote syntax detection (`[^1]`)
  - [ ] Reference links to footnote definitions
  - [ ] Footnote definition rendering
  - [ ] Styling for footnotes

## Configuration

**No setup needed** – works out of the box! The extension automatically adapts to your VS Code theme.

### Toggle Decorations

- Click the **toolbar button** in the editor to toggle decorations on/off
- Or use the command palette: `Ctrl+Shift+P` / `Cmd+Shift+P` → "Toggle Markdown Decorations"

The toggle state is global (applies to all markdown files). Per-file toggle state is planned for a future release.

### Cursor-Based Decoration Hiding

The extension automatically hides decorations around your cursor or selection to reveal raw Markdown syntax. Customize this behavior with the following settings:

#### `mdInline.cursorDisables` (default: `true`)

Hide decorations that intersect with cursor or selection. When enabled, decorations automatically hide around your cursor position or selected text, revealing the raw Markdown syntax for editing.

**Example:** When your cursor is on `**bold text**`, the bold decoration hides and you see the raw `**bold text**` syntax.

#### `mdInline.cursorLineDisables` (default: `false`)

Expand selection to full lines before hiding intersecting decorations. When enabled, the extension treats your cursor position as if the entire line is selected, hiding all decorations on that line.

**Use case:** Useful when you want to see all raw Markdown on a line, not just around the cursor position.

#### Special Behavior for Headings

When you click on a heading line:
- The `#` markers become visible (hide decoration is removed)
- Font size returns to normal (heading font-size decoration is hidden)
- Other inline decorations (bold, italic, etc.) remain applied

This makes it easy to edit heading levels while keeping other formatting visible.

### Configuration Example

Add to your VS Code `settings.json`:

```json
{
  "mdInline.cursorDisables": true,
  "mdInline.cursorLineDisables": false
}
```

## Development

### Prerequisites

- **Node.js** 20 or higher
- **VS Code** 1.88.0+ (or Cursor IDE)
- **Git** for version control

### Setup

```bash
git clone https://github.com/SeardnaSchmid/markdown-inline-editor-vscode.git
cd markdown-inline-editor-vscode
npm install
npm run compile
npm test
```

### Key Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | TypeScript compilation |
| `npm run bundle` | Bundle with esbuild |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |
| `npm run package` | Create `.vsix` package |
| `npm run clean` | Clean build artifacts |

### Architecture

```
src/
├── extension.ts          # Extension entry point and activation
├── parser.ts             # Markdown AST parsing (remark-based)
├── parser-remark.ts      # Remark dependency helper
├── decorator.ts          # Decoration management and caching
├── decorations.ts        # VS Code decoration type definitions
├── link-provider.ts      # Clickable link provider
└── parser/__tests__/     # Comprehensive test suite (215+ tests)
```

**Key Technologies:**
- [remark](https://github.com/remarkjs/remark) – Markdown parser
- [unified](https://github.com/unifiedjs/unified) – AST processing
- [VS Code Extension API](https://code.visualstudio.com/api) – Editor integration

### Debugging

1. Press `F5` to launch Extension Development Host
2. Open a markdown file in the new window
3. Test your changes

See [`AGENTS.md`](AGENTS.md) for contribution guidelines and agent roles, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for detailed development workflow.

## Troubleshooting

### Decorations Not Showing?

1. **Check file extension** – Ensure file is `.md`, `.markdown`, or `.mdx`
2. **Toggle decorations** – Click the toolbar button to enable/disable
3. **Reload window** – `Ctrl/Cmd+Shift+P` → "Developer: Reload Window"
4. **Check extension status** – Verify extension is activated in the Extensions view

### Performance Issues?

- **Large files** – Files over 1MB may experience slower parsing
- **Temporarily disable** – Use the toolbar button to toggle decorations off
- **Check performance** – `Help` → `Startup Performance` to diagnose issues
- **Report issues** – If performance is consistently poor, please [open an issue](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues)

### Known Limitations

- **Ordered lists** – Currently displayed as-is (auto-numbering planned for future release)
- **Tables** – Table syntax hiding is planned
- **Mermaid diagrams** – Diagram rendering is planned
- **Math formulas** – KaTeX/MathJax support is planned

### Found a Bug?

Please [open an issue](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues) with:
- VS Code version
- Extension version
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots if applicable

## Contributing

Contributions are welcome! This project follows [Conventional Commits](https://www.conventionalcommits.org/) and maintains high code quality standards.

### Quick Start

```bash
git checkout -b feat/my-feature
# Make changes, write tests
npm test && npm run lint
git commit -m "feat(parser): add definition list support"
```

### Contribution Guidelines

- **Read first:** [`CONTRIBUTING.md`](CONTRIBUTING.md) for detailed workflow
- **Code style:** TypeScript strict mode, JSDoc comments, comprehensive tests
- **Commit format:** `<type>(<scope>): <description>`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
- **Testing:** All changes must include tests (215+ existing tests)
- **Performance:** No regressions – see [`docs/PERFORMANCE_IMPROVEMENTS.md`](docs/project/additional-docs/PERFORMANCE_IMPROVEMENTS.md)

### Feature Requests

Check [`TODO.md`](TODO.md) and [`docs/FEATURE_IDEAS.md`](docs/FEATURE_IDEAS.md) for planned features and priorities.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for full contribution guidelines and [`AGENTS.md`](AGENTS.md) for agent roles and architecture details.

## License

MIT License – See [LICENSE.txt](LICENSE.txt)

## Acknowledgments

Built with:
- [remark](https://github.com/remarkjs/remark) – Markdown parser
- [unified](https://github.com/unifiedjs/unified) – AST processing framework
- [remark-gfm](https://github.com/remarkjs/remark-gfm) – GitHub Flavored Markdown support
- [VS Code Extension API](https://code.visualstudio.com/api) – Editor integration

---

**Important:** Your files remain standard `.md` – this extension only affects the editor view. All markdown syntax is preserved in the file.

[ci-img]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/ci.yaml/badge.svg
[ci]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/ci.yaml