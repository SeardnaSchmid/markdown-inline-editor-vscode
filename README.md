# Markdown Inline Editor [![CI/CD Status][ci-img]][ci] [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.txt)

<img src="assets/icon.png" align="right" alt="Extension Icon" width="120" height="120">

**Write Markdown like a rich text editor** – see **bold**, *italic*, and `code` styled inline while syntax markers stay hidden. Click to edit raw Markdown. Your files remain 100% standard `.md`.

**Why?** Less clutter, more focus. Git-friendly. Works everywhere.

## ✨ Key Features

* **Hide syntax** – No more `**`, `~~`, backticks cluttering your view
* **Smart reveal** – Click any text to instantly see/edit raw Markdown  
* **Fast** – Intelligent caching, no lag on selection changes
* **Compatible** – Standard `.md` files, works with any tool
* **Theme-aware** – Automatically adapts to your VS Code theme
* **Zero configuration** – Works out of the box

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

## Get Started: Install the Extension

1. **Install** the extension from:
   - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=CodeSmith.markdown-inline-editor-vscode)
   - [OpenVSX Registry](https://open-vsx.org/extension/CodeSmith/markdown-inline-editor-vscode)
   - [Github Releases](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/releases)
2. **Open** any `.md` file
3. **Start typing** – formatting appears automatically with syntax hidden
4. **Click/select text** to reveal raw Markdown for editing
5. **Toggle anytime** – Click the toolbar button or use `Ctrl+Shift+P` / `Cmd+Shift+P` → "Toggle Markdown Decorations"

## Recommended Extensions

Enhance your Markdown workflow with these complementary extensions:

- **[Markdown All in One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one)**
    - Keyboard shortcuts (e.g., <kbd>Alt</kbd>+<kbd>C</kbd> to toggle checkboxes)
    - Auto-formatting, table of contents, preview, and more

- **[Mermaid Chart](https://marketplace.visualstudio.com/items?itemName=MermaidChart.vscode-mermaid-chart)**
    - Create and edit diagrams directly within Markdown
    - Preview and quickly iterate on charts

## Supported Features

The extension currently supports **13 markdown features** with syntax hiding. Formatting appears inline while syntax markers stay hidden—click any text to reveal and edit raw Markdown.

### Text Formatting
* [x] **Bold** (`**text**`) • [Details](docs/features/bold.md)
* [x] **Italic** (`*text*`) • [Details](docs/features/italic.md)
* [x] **Bold + Italic** (`***text***`) • [Details](docs/features/bold-italic.md)
* [x] **Strikethrough** (`~~text~~`) • [Details](docs/features/strikethrough.md)
* [x] **Inline Code** (`` `code` ``) • [Details](docs/features/inline-code.md)

### Structure
* [x] **Headings** (`# H1` through `###### H6`) • [Details](docs/features/headings.md)
* [x] **Links** (`[text](url)`) • [Details](docs/features/links.md)
* [x] **Images** (`![alt](img.png)`) • [Details](docs/features/images.md)
* [x] **Blockquotes** (`> quote`) • [Details](docs/features/blockquotes.md)
* [x] **Horizontal Rules** (`---`, `***`, `___`) • [Details](docs/features/horizontal-rules.md)

### Lists
* [x] **Unordered Lists** (`-`, `*`, `+`) • [Details](docs/features/unordered-lists.md)
* [x] **Task Lists** (`- [ ]` / `- [x]`) • [Details](docs/features/task-lists.md)

### Code
* [x] **Code Blocks** (`` ```lang ``) • [Details](docs/features/code-blocks.md)
* [x] **YAML Frontmatter** • [Details](docs/features/yaml-frontmatter.md) • [Issue #27](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/27)

### Configuration
* [x] **Show Raw Markdown in Diffs** • [Details](docs/features/show-raw-markdown-in-diffs.md) • [Issue #20](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/20)
* [x] **Show Raw Markdown in Editor** • [Details](docs/features/show-raw-markdown-in-editor.md)

## Upcoming Features

### Work in progress
* [ ] **Set Default Feature Activation** – Allow users to configure which Markdown features are decorated/enabled by default (e.g., selectively apply decorators for headings, bold, italic, etc.) • [Details](docs/features/default-feature-activation.md)

### High Priority
* [ ] **Tables** • [Details](docs/features/tables.md) • [Issue #23](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/23)
* [ ] **Autolinks** • [Details](docs/features/autolinks.md) • [Issue #24](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/24)
* [ ] **Mermaid Diagrams** • [Details](docs/features/mermaid-diagrams.md) • [Issue #26](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/26)
* [ ] **LaTeX/Math** • [Details](docs/features/latex-math.md) • [Issue #6](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/6)

### Medium Priority
* [ ] **Per-File Toggle State** • [Details](docs/features/per-file-toggle-state.md) • [Issue #28](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/28)
* [ ] **Column alignment in tables with markup** • [Details](docs/features/table-column-alignment.md) • [Issue #21](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/21)

### Low Priority
* [x] **HTML Tags** • [Details](docs/features/html-tags.md) • [Issue #29](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/29)
* [ ] **Mentions/References** • [Details](docs/features/mentions-references.md) • [Issue #25](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/25)
* [ ] **Emoji Support** • [Details](docs/features/emoji-support.md) • [Issue #30](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/30)
* [ ] **Ordered List Auto-Numbering** • [Details](docs/features/ordered-list-auto-numbering.md) • [Issue #31](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/31)
* [ ] **Footnotes** • [Details](docs/features/footnotes.md) • [Issue #32](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/32)

## Getting Started (Developers)

### Quick Setup (TLDR)

```bash
git clone https://github.com/SeardnaSchmid/markdown-inline-editor-vscode.git
cd markdown-inline-editor-vscode
npm install
npm run compile
npm test
```

Press `F5` to launch the Extension Development Host and test your changes.

### Dependencies

**Key Technologies:**
- **TypeScript** 5.9+ – Type-safe development
- **VS Code API** 1.88.0+ – Editor integration and decoration system
- **[remark](https://github.com/remarkjs/remark)** – Markdown parser for precise AST-based parsing
- **[unified](https://github.com/unifiedjs/unified)** – AST processing framework
- **[remark-gfm](https://github.com/remarkjs/remark-gfm)** – GitHub Flavored Markdown support
- **Jest** – Testing framework

**Runtime Requirements:**
- **Node.js** 20 or higher
- **VS Code** 1.88.0+ (or Cursor IDE)

**Production Dependencies:**
- `remark-gfm`, `remark-parse`, `unified`, `unist-util-visit`

**Development Dependencies:**
- TypeScript, Jest, ESLint, VS Code extension tools

### Architecture

```
src/
├── extension.ts          # Extension entry point and activation
├── parser.ts             # Markdown AST parsing (remark-based)
├── parser-remark.ts      # Remark dependency helper
├── decorator.ts          # Decoration management and caching
├── decorations.ts        # VS Code decoration type definitions
├── link-provider.ts      # Clickable link provider
├── position-mapping.ts   # Position mapping utilities (CRLF handling)
└── parser/__tests__/     # Comprehensive test suite
```

**How it works:**
1. **Parser** (`parser.ts`) – Uses remark to parse Markdown into an AST
2. **Decorator** (`decorator.ts`) – Manages VS Code decorations to hide syntax markers
3. **Caching** – Intelligent caching prevents redundant parsing on selection changes
4. **Reveal on selection** – Clicking text reveals raw Markdown for editing

### Installing

```bash
npm install
```

### Key Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run bundle` | Bundle with esbuild |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |
| `npm run package` | Create `.vsix` package |
| `npm run clean` | Clean build artifacts |
| `npm run build` | Full build (compile + bundle + package) |

### Executing

**Option 1: VS Code Launch Configuration**

Create `.vscode/launch.json` with the extension host configuration, then press `F5` to launch the Extension Development Host.

**Option 2: Manual Build & Test**

```bash
npm run compile
npm run package
code --install-extension dist/extension.vsix
```

## Contributing

Contributions are welcome! This project follows [Conventional Commits](https://www.conventionalcommits.org/) and maintains high code quality standards.

### Quick Start

```bash
git checkout -b feat/my-feature
# Make changes, write tests
npm test && npm run lint
git commit -m "feat(parser): add support for definition lists"
```

### Contribution Guidelines (TLDR)

- **Read first:** [`CONTRIBUTING.md`](CONTRIBUTING.md) for detailed workflow
- **Code style:** TypeScript strict mode, JSDoc comments, comprehensive tests
- **Commit format:** `<type>(<scope>): <description>`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
- **Testing:** All changes must include tests
- **Performance:** No regressions – maintain efficient code execution

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for full contribution guidelines and [`AGENTS.md`](AGENTS.md) for agent roles and architecture details.

## Known Limitations & Reporting Bugs

### Known Limitations

- **Ordered lists** – Currently displayed as-is (auto-numbering planned)
- **Tables** – Table syntax hiding is in progress
- **Mermaid diagrams** – Diagram rendering is in progress
- **Math formulas** – KaTeX/MathJax support is planned
- **H1 heading clipping** – Text goes out of window when H1 is on first line – [#4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/4)

### Reporting Bugs

If you encounter an issue not covered in the [FAQ](docs/FAQ.md), please [open an issue](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues) with:
- VS Code version
- Extension version
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots if applicable

For common issues and solutions, see the [FAQ](docs/FAQ.md).

## License

MIT License – See [LICENSE.txt](LICENSE.txt)

## Acknowledgments

Special thanks to these projects, which inspired or enabled this extension:

- [markdown-inline-preview-vscode](https://github.com/domdomegg/markdown-inline-preview-vscode) by [domdomegg](https://github.com/domdomegg) – Original concept and codebase for using VS Code decorations to hide markdown syntax (MIT License, Copyright (c) Adam Jones (domdomegg))
- [Markdown Inline Preview](https://marketplace.visualstudio.com/items?itemName=markdown-inline-preview.markdown-inline-preview) by [markdown-inline-preview](https://marketplace.visualstudio.com/publishers/markdown-inline-preview) – Horizontal rule implementation using border-bottom approach that prevents editor width expansion
- [Markdown WYSIWYG](https://marketplace.visualstudio.com/items?itemName=remcohaszing.markdown-decorations) by [remcohaszing](https://github.com/remcohaszing) – Decoration-based markdown editor with similar approach
- [markless](https://github.com/tejasvi/markless) by [tejasvi](https://github.com/tejasvi) – Advanced decoration-based markdown editor with Mermaid and LaTeX support
- [Typora](https://typora.io/) – Original inspiration for the inline markdown editing concept
- [Obsidian](https://obsidian.md/) – Markdown-based knowledge management application that inspired the editing experience

[ci-img]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/ci.yaml/badge.svg
[ci]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/ci.yaml
