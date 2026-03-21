# Markdown Inline Editor

<img src="assets/icon.png" align="right" alt="Markdown Inline Editor icon" width="120" height="120">

[![CI/CD Status][ci-img]][ci] [![VS Code Marketplace][marketplace-img]][marketplace] [![OpenVSX][openvsx-img]][openvsx] [![License: MIT][license-img]][license]

**Typora-like Markdown editing in VS Code.** Write in a clean, WYSIWYG-style view with context-aware syntax shadowing, **GFM pipe tables**, inline Mermaid and LaTeX math rendering, hover previews, and clickable task lists.

Your files stay 100% standard Markdown. This extension uses editor decorations — it never rewrites your document.

- **Install:** [VS Code Marketplace][marketplace] • [OpenVSX][openvsx] • [Download VSIX][releases]
- **Jump to:** [Why people install it](#why-people-install-it) • [Demo](#demo) • [Get started](#get-started) • [3-state syntax shadowing](#3-state-syntax-shadowing) • [Customize](#customize-optional) • [Supported features](#supported-features) • [FAQ][faq]
- **Project:** [Repository][repo] • [Changelog][changelog] • [Issues][issues] • [Roadmap](#roadmap)

## Why people install it

- **No preview pane needed:** headings, emphasis, links, images, lists, code, **GFM tables**, math, and Mermaid render inline where you write.
- **Rendered -> Ghost -> Raw syntax shadowing:** Markdown markers stay out of the way until you need them, then fade in on the active line or fully reveal for precise edits.
- **GFM tables:** pipe characters and cell text are drawn as an aligned grid; place the cursor anywhere in the table to reveal raw `|` syntax for editing.
- **Inline Mermaid and LaTeX math:** render `` ```mermaid `` diagrams, `$...$`, `$$...$$`, and `` ```math `` blocks directly in the editor.
- **Interactive Markdown:** click task list checkboxes to toggle them, hover links to see targets, and hover images to preview them.
- **Safe for real workflows:** files remain plain Markdown, and diffs stay raw by default for Git, merge editor, and Copilot inline review contexts.
- **Theme-aware, configurable, and fast:** matches your VS Code theme, lets you tune colors/opacity/behavior, and uses a shared parse cache to avoid lag during normal editing.

## Demo

<p align="center">
  <img src="assets/autoplay-demo.gif" alt="Markdown Inline Editor demo" width="900">
</p>

*Tip: move the cursor onto a line to see faint “ghost” markers; click/select to reveal raw Markdown for precise edits.*

## Get started

1. **Install**:
   - [VS Code Marketplace][marketplace]
   - [OpenVSX][openvsx]
   - [GitHub Releases][releases]
2. **Open** a Markdown file (`.md`) to activate the extension. (It also supports editors with `markdown`/`md`/`mdx` language IDs once active.)
3. **Start typing** – formatting appears inline while syntax is hidden (**Rendered** state).
4. **Move the cursor** onto a line – syntax fades in for edit cues (**Ghost** state).
5. **Click/select** inside formatted text – raw Markdown becomes fully visible (**Raw** state).
6. **Toggle anytime** – Command Palette → **Toggle Markdown Decorations** (command id: `mdInline.toggleDecorations`) or use the editor title bar eye icon.

**Requirement:** VS Code 1.88+ (Cursor is supported too).

If decorations aren’t showing, see the [FAQ][faq].

## Why inline (instead of a preview pane)?

VS Code’s Markdown preview is great for reading. Markdown Inline Editor is for *writing*: it keeps you in the editor, reduces syntax noise, and reveals raw Markdown only where you’re editing.

## Feature videos

- **Start here:** [Watch the feature][demo-overview]
- **Mermaid:** [Watch inline Mermaid rendering][demo-mermaid]
- **Task lists:** [Watch checkbox toggling + syntax shadowing][demo-checkbox]

## Commands

- **Toggle Markdown Decorations** (`mdInline.toggleDecorations`): Enable/disable inline Markdown rendering.

## Recommended extensions (optional)

- **[Markdown All in One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one)**: Shortcuts, auto-formatting, table of contents, preview, and more.
- **[Mermaid Chart](https://marketplace.visualstudio.com/items?itemName=MermaidChart.vscode-mermaid-chart)**: Mermaid authoring tools and preview.

## 3-state syntax shadowing

The extension uses an intelligent **3-state syntax shadowing system** that adapts syntax visibility based on your editing context:

### **Rendered State** (Default)
- Syntax markers are **hidden** – see only formatted content
- Clean, distraction-free reading experience
- Example: `**bold**` appears as **bold** with no visible markers

### **Ghost State** (Cursor on line)
- Syntax markers appear **faintly** (30% opacity by default, configurable)
- Provides edit cues without cluttering the view
- Only applies to constructs on the active line, not the entire document
- Example: Cursor on a line with `**bold**` shows faint `**` markers

### **Raw State** (Cursor/selection inside construct)
- Syntax markers are **fully visible** for direct editing
- Precise scope detection – only the specific construct you're editing shows raw
- Example: Cursor inside `**bold**` reveals the full `**bold**` syntax

**Special behavior for structural markers:**
- **Blockquotes, lists, and checkboxes** stay fully rendered on active lines unless you directly click on the marker
- **Headings** show raw `#` markers and remove styling when cursor is on the heading line
- **Ordered list numbers** always remain visible
- **Tables** switch the **entire** table to raw Markdown (all rows) when your cursor or selection is on any line inside the table

Configure ghost opacity: `markdownInlineEditor.decorations.ghostFaintOpacity` (default: 0.3)
Configure emoji shortcodes: `markdownInlineEditor.emojis.enabled` (default: true)

## Supported Features

The extension supports the following Markdown (and common GitHub-flavored) features with inline rendering and syntax hiding. Formatting appears inline while syntax markers stay hidden—click any text to reveal and edit raw Markdown.

### Text Formatting
- [x] **Bold** (`**text**`) • [Details][feat-bold]
- [x] **Italic** (`*text*`) • [Details][feat-italic]
- [x] **Bold + Italic** (`***text***`) • [Details][feat-bold-italic]
- [x] **Strikethrough** (`~~text~~`) • [Details][feat-strikethrough]
- [x] **Inline Code** (`` `code` ``) • [Details][feat-inline-code]

### Structure
- [x] **Headings** (`# H1` through `###### H6`) • [Details][feat-headings]
- [x] **Links** (`[text](url)`) • [Details][feat-links]
- [x] **Autolinks & bare links** (`<https://…>` / `user@example.com`) • [Details][feat-autolinks] • [Issue #24](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/24)
- [x] **Images** (`![alt](img.png)`) • [Details][feat-images]
- [x] **Blockquotes** (`> quote`) • [Details][feat-blockquotes]
- [x] **Horizontal Rules** (`---`, `***`, `___`) • [Details][feat-horizontal-rules]
- [x] **GFM Tables** (pipe tables, `|---|` separator row, `:---` / `:---:` / `---:` column alignment) • [Details][feat-tables]

### Lists
- [x] **Unordered Lists** (`-`, `*`, `+`) • [Details][feat-unordered-lists]
- [x] **Task Lists** (`- [ ]` / `- [x]`) • [Details][feat-task-lists]

### Code
- [x] **Code Blocks** (`` ```lang ``) • [Details][feat-code-blocks]
- [x] **YAML Frontmatter** • [Details][feat-yaml-frontmatter] • [Issue #27](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/27)
- [x] **Emoji Support** (`:smile:`) • [Details][feat-emoji-support] • [Issue #30](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/30)
- [x] **Mermaid Diagrams** (`` ```mermaid ``) • [Details][feat-mermaid-diagrams] • [Issue #26](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/26)
- [x] **LaTeX/Math** (`$...$`, `$$...$$`, ` ```math `) • [Details][feat-latex-math] • [Issue #6](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/6)

### Configuration
- [x] **Show Raw Markdown in Diffs** • [Details][feat-show-raw-markdown-in-diffs] • [Issue #20](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/20)
- [x] **Customizable Syntax Colors** (headings, links, lists, code, emphasis, blockquote, image, horizontal rule, checkbox) • [Details][feat-customizable-syntax-colors] • [Issue #49](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/49)

## Customize (optional)

Everything works out of the box. If you want to tune the experience, open Settings and search for **“Markdown Inline Editor”** (all keys start with `markdownInlineEditor.`).

- **Ghost markers visibility** (`decorations.ghostFaintOpacity`, default `0.3`)
  - Lower it for a cleaner look, raise it for stronger edit cues.
- **Diff view behavior** (`defaultBehaviors.diffView.applyDecorations`, default `false`)
  - Keep `false` to review raw Markdown in diffs; set `true` if you want the same inline rendering in diffs too.
- **Single-click links** (`links.singleClickOpen`, default `false`)
  - Opens links/images without Ctrl/Cmd-click, but may interfere with text selection.
- **Emoji shortcodes** (`emojis.enabled`, default `true`)
  - Disable if you prefer seeing `:shortcode:` text.
- **Syntax colors** (`colors.heading1` … `colors.checkbox`, 15 options including `inlineCodeBackground`)
  - Optional hex overrides (e.g. `#e06c75`) for headings, links, list markers, inline code, inline code background, emphasis, blockquote, image, horizontal rule, checkbox. Unset or invalid values use theme-derived defaults (for headings, unset keeps the editor’s markdown heading syntax colors rather than forcing a single foreground). See [Customizable Syntax Colors][feat-customizable-syntax-colors].

### Example `settings.json`

```json
{
  "markdownInlineEditor.decorations.ghostFaintOpacity": 0.25,
  "markdownInlineEditor.defaultBehaviors.diffView.applyDecorations": false,
  "markdownInlineEditor.links.singleClickOpen": false,
  "markdownInlineEditor.emojis.enabled": true
}
```

## Roadmap

Want to help? Pick an item below and open a PR (or add feedback in the linked issue/spec).

### Work in progress
- [ ] **Default feature activation** – configure which features are decorated by default • [Spec][todo-default-feature-activation]

### Medium priority
- [ ] **Per-file toggle state** • [Spec][todo-per-file-toggle-state] • [Issue #28](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/28)
- [ ] **Column alignment in tables with markup** • [Spec][todo-table-column-alignment] • [Issue #21](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/21)
- [ ] **Default decorator rendering** – open files with decorations on/off by default • [Spec][todo-default-decorator-rendering]
- [ ] **Image UX improvements** • [Spec][todo-image-ux-improvements]
- [ ] **Highlighting support** • [Spec][todo-highlighting-support]

### Low priority
- [ ] **Mentions/References** • [Spec][todo-mentions-references] • [Issue #25](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/25)
- [ ] **Ordered list auto-numbering** • [Spec][todo-ordered-list-auto-numbering] • [Issue #31](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/31)
- [ ] **HTML tags** • [Issue #29](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/29) (spec TBD)
- [ ] **Footnotes** • [Issue #32](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/32) (spec TBD)

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
├── config.ts             # Centralized configuration access
├── diff-context.ts       # Unified diff view detection and policy
├── link-targets.ts       # Unified link/image URL resolution
├── markdown-parse-cache.ts # Shared parsing and caching service
├── parser.ts             # Markdown AST parsing (remark-based)
├── parser-remark.ts     # Remark dependency helper
├── decorations.ts        # VS Code decoration type definitions
├── decorator.ts          # Decoration orchestration
├── decorator/
│   ├── decoration-type-registry.ts  # Decoration type lifecycle
│   ├── visibility-model.ts          # 3-state filtering logic
│   ├── checkbox-toggle.ts           # Checkbox click handling
│   └── decoration-categories.ts    # Decoration type categorization
├── link-provider.ts      # Clickable link provider
├── link-hover-provider.ts # Hover provider for link URLs
├── image-hover-provider.ts # Hover provider for image previews
├── link-click-handler.ts # Single-click navigation handler
├── position-mapping.ts   # Position mapping utilities (CRLF handling)
└── */__tests__/         # Comprehensive test suites
    ├── parser/__tests__/              # Parser tests
    ├── markdown-parse-cache/__tests__/ # Parse cache tests
    ├── diff-context/__tests__/        # Diff context tests
    ├── link-targets/__tests__/        # Link target resolution tests
    ├── link-provider/__tests__/       # Link provider tests
    ├── image-hover-provider/__tests__/ # Image hover tests
    ├── link-hover-provider/__tests__/  # Link hover tests
    └── link-click-handler/__tests__/   # Click handler tests
```

**How it works:**
1. **Parser** (`parser.ts`) – Uses remark to parse Markdown into an AST and extract scopes
2. **Shared Cache** (`markdown-parse-cache.ts`) – Single parse cache instance shared across all components
3. **Decorator** (`decorator.ts`) – Orchestrates decoration management with 3-state syntax shadowing
4. **Scope-based detection** – Precisely identifies markdown constructs for context-aware syntax visibility
5. **3-state model** – Rendered (hidden), Ghost (faint), Raw (visible) states adapt to editing context
6. **Hover providers** – Show image previews and link URLs on hover (use shared cache)
7. **Click handler** – Optional single-click navigation for links and images (uses shared cache)

### Testing

The project maintains comprehensive test coverage with **560+ passing tests** across 40+ test suites:

- **Parser tests** (`parser/__tests__/`) – Core markdown parsing logic (including GFM tables, math, Mermaid regions)
- **Parse cache tests** (`markdown-parse-cache/__tests__/`) – Shared caching and LRU eviction
- **Diff context tests** (`diff-context/__tests__/`) – Diff view detection and policy
- **Link target tests** (`link-targets/__tests__/`) – Link/image URL resolution
- **Image hover provider tests** (`image-hover-provider/__tests__/`) – Image preview hover functionality
- **Link hover provider tests** (`link-hover-provider/__tests__/`) – Link URL hover functionality
- **Link click handler tests** (`link-click-handler/__tests__/`) – Single-click navigation behavior
- **Link provider tests** (`link-provider/__tests__/`) – Clickable link provider functionality

Run tests with `npm test` or `npm run test:watch` for development.

### Installing

```bash
npm install
```

### Key Commands

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `npm run compile`       | Compile TypeScript to JavaScript        |
| `npm run bundle`        | Bundle with esbuild                     |
| `npm test`              | Run all tests                           |
| `npm run test:watch`    | Run tests in watch mode                 |
| `npm run test:coverage` | Generate coverage report                |
| `npm run lint`          | Run ESLint                              |
| `npm run validate`      | Run docs lint + tests + build           |
| `npm run package`       | Create `.vsix` package                  |
| `npm run clean`         | Clean build artifacts                   |
| `npm run build`         | Full build (compile + bundle + package) |
| `npm run release`       | Automated release workflow              |

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

- **Read first:** [`CONTRIBUTING.md`][contributing] for detailed workflow
- **Code style:** TypeScript strict mode, JSDoc comments, comprehensive tests
- **Commit format:** `<type>(<scope>): <description>`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
- **Testing:** All changes must include tests
- **Performance:** No regressions – maintain efficient code execution

See [`CONTRIBUTING.md`][contributing] for full contribution guidelines and [`AGENTS.md`][agents] for agent roles and architecture details.

## Known Limitations & Reporting Bugs

### Known Limitations

- **GFM tables** – Multi-line cells, nested block content in cells, and perfect alignment when *every* cell mixes multiple inline formats are limited or not supported yet • [Issue #21](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/21) • [Issue #23](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/23)
- **Ordered list auto-numbering** – Planned (numbers remain visible today) • [Issue #31](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/31)
- **H1 heading clipping** – Text can go out of window when H1 is on first line • [#4](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/4)
- **Very large files** – Files over ~1MB may parse more slowly (see [FAQ][faq])
- **Sidebar button** – A "Markdown Inline" button appears in the activity bar for Mermaid rendering (hidden webview). You can ignore it—it's not interactive. See [FAQ][faq] for details.

### Reporting Bugs

If you encounter an issue not covered in the [FAQ][faq], please [open an issue](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues) with:
- VS Code version
- Extension version
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots/GIFs if applicable

For common issues and solutions, see the [FAQ][faq].

## License

MIT License – See [LICENSE.txt][license]

## Acknowledgments

Special thanks to these projects, which inspired or enabled this extension:

- [markdown-inline-preview-vscode](https://github.com/domdomegg/markdown-inline-preview-vscode) by [domdomegg](https://github.com/domdomegg) – Original concept and codebase for using VS Code decorations to hide markdown syntax (MIT License, Copyright (c) Adam Jones (domdomegg))
- [Markdown Inline Preview](https://marketplace.visualstudio.com/items?itemName=markdown-inline-preview.markdown-inline-preview) by [markdown-inline-preview](https://marketplace.visualstudio.com/publishers/markdown-inline-preview) – Horizontal rule implementation using border-bottom approach that prevents editor width expansion
- [Markdown WYSIWYG](https://marketplace.visualstudio.com/items?itemName=remcohaszing.markdown-decorations) by [remcohaszing](https://github.com/remcohaszing) – Decoration-based markdown editor with similar approach
- [markless](https://github.com/tejasvi/markless) by [tejasvi](https://github.com/tejasvi) – Advanced decoration-based markdown editor with Mermaid and LaTeX support
- [Typora](https://typora.io/) – Original inspiration for the inline markdown editing concept
- [Obsidian](https://obsidian.md/) – Markdown-based knowledge management application that inspired the editing experience

### Contributors

- [@patrick-yip](https://github.com/patrick-yip)
- [@bircni](https://github.com/bircni)
- [@ssebs](https://github.com/ssebs)
- [@IrishBruse](https://github.com/IrishBruse)

[ci-img]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/ci.yaml/badge.svg
[ci]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/actions/workflows/ci.yaml

[repo]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode
[releases]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/releases
[issues]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues
[changelog]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/CHANGELOG.md
[contributing]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/CONTRIBUTING.md
[agents]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/AGENTS.md
[faq]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/FAQ.md
[license]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/LICENSE.txt

[marketplace]: https://marketplace.visualstudio.com/items?itemName=CodeSmith.markdown-inline-editor-vscode
[openvsx]: https://open-vsx.org/extension/CodeSmith/markdown-inline-editor-vscode

[marketplace-img]: https://img.shields.io/visual-studio-marketplace/v/CodeSmith.markdown-inline-editor-vscode?label=VS%20Code%20Marketplace
[openvsx-img]: https://img.shields.io/open-vsx/v/CodeSmith/markdown-inline-editor-vscode?label=OpenVSX
[license-img]: https://img.shields.io/badge/License-MIT-yellow.svg

[demo-mermaid]: https://github.com/user-attachments/assets/9898d617-acbb-4e81-944b-623d545a29ce
[demo-checkbox]: https://github.com/user-attachments/assets/c9025dd2-c2ca-44e5-a501-c9638a5e60cc
[demo-overview]: https://github.com/user-attachments/assets/8bad925d-1538-4105-b5b5-c8db493f9734

[feat-autolinks]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/autolinks.md
[feat-blockquotes]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/blockquotes.md
[feat-bold]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/bold.md
[feat-bold-italic]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/bold-italic.md
[feat-code-blocks]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/code-blocks.md
[feat-emoji-support]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/emoji-support.md
[feat-headings]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/headings.md
[feat-horizontal-rules]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/horizontal-rules.md
[feat-tables]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/55
[feat-images]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/images.md
[feat-inline-code]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/inline-code.md
[feat-italic]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/italic.md
[feat-links]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/links.md
[feat-latex-math]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/latex-math.md
[feat-mermaid-diagrams]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/mermaid-diagrams.md
[feat-show-raw-markdown-in-diffs]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/show-raw-markdown-in-diffs.md
[feat-customizable-syntax-colors]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/customizable-syntax-colors.md
[feat-strikethrough]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/strikethrough.md
[feat-task-lists]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/task-lists.md
[feat-unordered-lists]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/unordered-lists.md
[feat-yaml-frontmatter]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/done/yaml-frontmatter.md

[todo-default-decorator-rendering]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/todo.md#default-decorator-rendering
[todo-default-feature-activation]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/todo.md#default-feature-activation
[todo-highlighting-support]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/todo.md#highlighting-support
[todo-image-ux-improvements]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/todo.md#image-ux-improvements
[todo-mentions-references]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/todo.md#mentions-and-references-styling
[todo-ordered-list-auto-numbering]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/todo.md#ordered-list-auto-numbering
[todo-per-file-toggle-state]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/todo.md#per-file-toggle-state
[todo-table-column-alignment]: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/blob/main/docs/features/todo.md#table-column-alignment-with-markup
