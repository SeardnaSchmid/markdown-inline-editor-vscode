# Markdown Inline Editor

A VS Code extension that provides a WYSIWYG inline markdown editing experience. Hide syntax clutter and focus on your content with a clean, preview-like view directly in the editor.

## Features

- **Hide Syntax Markers**: Automatically hides markdown syntax characters (`**`, `*`, `~~`, backticks, etc.)
- **Inline Preview**: See formatted markdown directly in the editor without switching to preview
- **Enhanced Headings**: Larger, more prominent heading styles
- **Clickable Links**: Click on markdown links to navigate
- **Toggle Decorations**: Easily toggle decorations on/off with a single click
- **Supports**: Standard markdown, GitHub Flavored Markdown (GFM), and MDX files

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Markdown Inline Editor"
4. Click Install

### From Open VSX Registry

1. Open VS Code
2. Go to Extensions
3. Search for "Markdown Inline Editor" in Open VSX
4. Click Install

### Manual Installation

1. Download the `.vsix` file from [Releases](https://github.com/seardnaschmid/md-inline-editor-vscode/releases)
2. Open VS Code
3. Go to Extensions
4. Click the `...` menu and select "Install from VSIX..."
5. Select the downloaded `.vsix` file

## Usage

The extension automatically activates when you open a markdown file (`.md`, `.markdown`, `.mdx`).

### Toggle Decorations

- Click the eye icon (👁️) in the editor toolbar, or
- Use the Command Palette (Ctrl+Shift+P / Cmd+Shift+P) and search for "Toggle Markdown Decorations"

### Recommended Settings

For the best experience, consider adding these settings to your `.vscode/settings.json`:

```json
{
  "[markdown]": {
    "editor.quickSuggestions": {
      "other": false,
      "comments": false,
      "strings": false
    },
    "editor.fontFamily": "Fira Sans",
    "editor.wrappingStrategy": "advanced",
    "editor.fontSize": 13,
    "editor.lineHeight": 1.5,
    "editor.cursorBlinking": "phase",
    "editor.lineNumbers": "off",
    "editor.indentSize": "tabSize",
    "editor.tabSize": 6,
    "editor.insertSpaces": false,
    "editor.autoClosingBrackets": "never",
    "editor.bracketPairColorization.enabled": false,
    "editor.matchBrackets": "never",
    "editor.guides.indentation": false,
    "editor.padding.top": 20
  }
}
```

## Supported Markdown Features

- **Headings** (H1-H6)
- **Bold** and *italic* text
- **Strikethrough** text
- `Inline code` and code blocks
- > Blockquotes
- Links and images
- Horizontal rules

## Development

### Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/seardnaschmid/md-inline-editor-vscode.git
   cd md-inline-editor-vscode
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Run the extension:
   - Open the project in VS Code
   - Press F5 to launch a new Extension Development Host window
   - Open a markdown file in the new window to test

### Scripts

- `npm run lint` - Lint the codebase
- `npm run clean` - Remove build artifacts
- `npm run build` - Build the extension
- `npm run deploy:prod` - Build and publish to marketplaces (requires tokens)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Issues

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/seardnaschmid/md-inline-editor-vscode/issues).