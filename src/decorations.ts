import { window, ThemeColor, ColorThemeKind } from 'vscode';

/**
 * Opacity value for brightness adjustment overlays.
 * Creates approximately 30% brightness change when composited over editor background.
 */
const BRIGHTNESS_OVERLAY_OPACITY = 0.1;

/**
 * Determines if the current theme is dark or high contrast.
 *
 * @returns {boolean} True if theme is dark or high contrast
 */
function isDarkTheme(): boolean {
  const themeKind = window.activeColorTheme.kind;
  return themeKind === ColorThemeKind.Dark || themeKind === ColorThemeKind.HighContrast;
}

/**
 * Creates a decoration type for hiding markdown syntax.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type that hides text
 */
export function HideDecorationType() {
  return window.createTextEditorDecorationType({
    // Hide the item
    textDecoration: 'none; display: none;',
    // This forces the editor to re-layout following text correctly
    after: {
      contentText: '',
    },
  });
}

/**
 * Creates a decoration type for making text transparent.
 *
 * Unlike HideDecorationType which uses display: none (removes from layout),
 * this keeps the text in the layout but makes it invisible. This is important
 * for inline code borders - the backticks need to exist in layout for borders
 * to render correctly.
 *
 * Matches Markless approach: uses color: transparent instead of display: none.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type that makes text transparent
 */
export function TransparentDecorationType() {
  return window.createTextEditorDecorationType({
    color: 'transparent',
  });
}

/**
 * Creates a decoration type for ghost (faint) markdown syntax markers.
 *
 * Used in Ghost state to show subtle edit cues without fully restoring raw layout.
 * Makes markers faintly visible so users can locate formatting boundaries.
 *
 * @param {number} opacity - Opacity value between 0.0 and 1.0 (default: 0.3)
 * @returns {vscode.TextEditorDecorationType} A decoration type that makes text faint
 */
export function GhostFaintDecorationType(opacity: number = 0.3) {
  // Clamp opacity to valid range
  const clampedOpacity = Math.max(0, Math.min(1, opacity));
  return window.createTextEditorDecorationType({
    opacity: clampedOpacity.toString(),
  });
}

/**
 * Creates a decoration type for code block language identifiers.
 *
 * Renders the language identifier (e.g., "python", "javascript") with a subtle badge-like appearance.
 * Uses reduced opacity, italic style, and underline to create a non-intrusive label
 * that clearly indicates the language without competing with the code content.
 *
 * @param {number} opacity - Opacity value between 0.0 and 1.0 (default: 0.3)
 * @returns {vscode.TextEditorDecorationType} A decoration type for code block language identifiers
 */
export function CodeBlockLanguageDecorationType(opacity: number = 0.3) {
  // Clamp opacity to valid range
  const clampedOpacity = Math.max(0, Math.min(1, opacity));
  return window.createTextEditorDecorationType({
    opacity: clampedOpacity.toString(),
    fontStyle: 'italic',
    textDecoration: 'underline',
  });
}

/**
 * Creates a decoration type for bold text styling.
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses default (no color override)
 * @returns {vscode.TextEditorDecorationType} A decoration type for bold text
 */
export function BoldDecorationType(color?: string | ThemeColor) {
  const options: Record<string, unknown> = { fontWeight: 'bold' };
  if (color !== undefined) {
    options.color = color;
  }
  return window.createTextEditorDecorationType(options);
}

/**
 * Creates a decoration type for italic text styling.
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses default
 * @returns {vscode.TextEditorDecorationType} A decoration type for italic text
 */
export function ItalicDecorationType(color?: string | ThemeColor) {
  const options: Record<string, unknown> = { fontStyle: 'italic' };
  if (color !== undefined) {
    options.color = color;
  }
  return window.createTextEditorDecorationType(options);
}

/**
 * Creates a decoration type for bold+italic text styling.
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses default
 * @returns {vscode.TextEditorDecorationType} A decoration type for bold+italic text
 */
export function BoldItalicDecorationType(color?: string | ThemeColor) {
  const options: Record<string, unknown> = { fontWeight: 'bold', fontStyle: 'italic' };
  if (color !== undefined) {
    options.color = color;
  }
  return window.createTextEditorDecorationType(options);
}

/**
 * Creates a decoration type for strikethrough text styling.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type for strikethrough text
 */
export function StrikethroughDecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: 'line-through',
  });
}

/**
 * Creates a decoration type for inline code styling.
 *
 * Uses the editor background color with theme-aware brightness adjustment:
 * - Dark themes: Lightens by ~30% using white overlay
 * - Light themes: Darkens by ~30% using black overlay
 *
 * Since VS Code doesn't allow reading ThemeColor values, we use semi-transparent
 * overlays that composite over the editor background.
 *
 * Note: This decoration type is automatically recreated when the theme changes
 * via {@link Decorator.recreateCodeDecorationType}, ensuring the background color
 * adapts to the current theme without requiring a restart.
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color for text; when undefined only background is applied
 * @param {string | ThemeColor | undefined} backgroundColor - Optional hex or theme color for background overlay; when undefined uses theme-aware default (white for dark, black for light)
 * @returns {vscode.TextEditorDecorationType} A decoration type for inline code
 */
export function CodeDecorationType(
  color?: string | ThemeColor,
  backgroundColor?: string | ThemeColor,
) {
  const isDark = isDarkTheme();
  let bgColor: string | ThemeColor;
  if (backgroundColor !== undefined) {
    bgColor = backgroundColor;
  } else {
    bgColor = isDark
      ? `rgba(255, 255, 255, ${BRIGHTNESS_OVERLAY_OPACITY})`
      : `rgba(0, 0, 0, ${BRIGHTNESS_OVERLAY_OPACITY})`;
  }
  const options: Record<string, unknown> = {
    backgroundColor: bgColor,
  };
  if (color !== undefined) {
    options.color = color;
  }
  return window.createTextEditorDecorationType(options);
}

/**
 * Creates a decoration type for code block styling.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type for code blocks
 */
export function CodeBlockDecorationType() {
  return window.createTextEditorDecorationType({
    backgroundColor: new ThemeColor('textCodeBlock.background'),
    isWholeLine: true, // Extend background to full line width
  });
}

/**
 * Creates a decoration type that overlays VS Code's selection background color.
 *
 * This is used to restore visible selection highlight on top of opaque
 * block background decorations (e.g. fenced code blocks, frontmatter),
 * in themes where the block background can visually overpower the native selection.
 */
export function SelectionOverlayDecorationType() {
  return window.createTextEditorDecorationType({
    backgroundColor: new ThemeColor('editor.selectionBackground'),
  });
}

/**
 * Creates a decoration type for YAML frontmatter styling.
 *
 * Highlights the entire frontmatter block (including --- delimiters) with a background color,
 * similar to code blocks. The delimiters remain visible.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type for frontmatter blocks
 */
export function FrontmatterDecorationType() {
  return window.createTextEditorDecorationType({
    backgroundColor: new ThemeColor('textCodeBlock.background'),
    isWholeLine: true, // Extend background to full line width
  });
}

/**
 * Creates a decoration type for frontmatter delimiters (---).
 *
 * Renders the frontmatter delimiters with reduced opacity to make them
 * visible but subtle, similar to code block language identifiers.
 *
 * @param {number} opacity - Opacity value between 0.0 and 1.0 (default: 0.3)
 * @returns {vscode.TextEditorDecorationType} A decoration type for frontmatter delimiters
 */
export function FrontmatterDelimiterDecorationType(opacity: number = 0.3) {
  // Clamp opacity to valid range
  const clampedOpacity = Math.max(0, Math.min(1, opacity));
  return window.createTextEditorDecorationType({
    opacity: clampedOpacity.toString(),
  });
}

/**
 * Creates a decoration type for emoji shortcodes.
 *
 * Hides the original shortcode and allows per-range emoji rendering
 * via {@link vscode.DecorationOptions.renderOptions}.
 */
export function EmojiDecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: {
      contentText: '',
    },
  });
}

/**
 * Creates a decoration type for heading styling.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type for headings
 */
export function HeadingDecorationType() {
  return window.createTextEditorDecorationType({
    fontWeight: 'bold',
  });
}

/**
 * Heading decoration configuration
 */
const HEADING_CONFIG = [
  { size: '180%', bold: true },  // H1: Distinct, but not overwhelming
  { size: '140%', bold: true },  // H2: Clearly a subsection
  { size: '120%', bold: true },  // H3: Just above body text
  { size: '110%', bold: false }, // H4: Subtle bump
  { size: '100%', bold: false }, // H5: Same size, usually distinct by color/bold
  { size: '90%',  bold: false }, // H6: Slightly diminished
];
/**
 * Creates a heading decoration type with the specified level.
 *
 * @param {number} level - Heading level (1-6)
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color. When **undefined** (empty extension setting = theme default), the decoration **omits** `color` so the editor keeps syntax-highlighted markdown heading colors for the active theme. When set, that color overrides the token foreground for the decorated range.
 * @returns {vscode.TextEditorDecorationType} A decoration type for the heading level
 */
function createHeadingDecoration(level: number, color?: string | ThemeColor) {
  const config = HEADING_CONFIG[level - 1];
  if (!config) throw new Error(`Invalid heading level: ${level}`);
  const options: Record<string, unknown> = {
    textDecoration: `none; font-size: ${config.size};`,
    ...(config.bold ? { fontWeight: 'bold' } : {}),
  };
  if (color !== undefined) {
    options.color = color;
  }
  return window.createTextEditorDecorationType(options);
}

/** @param color - When undefined (empty setting), omit `color` so theme markdown heading syntax colors apply. */
export function Heading1DecorationType(color?: string | ThemeColor) {
  return createHeadingDecoration(1, color);
}
/** @param color - When undefined (empty setting), omit `color` so theme markdown heading syntax colors apply. */
export function Heading2DecorationType(color?: string | ThemeColor) {
  return createHeadingDecoration(2, color);
}
/** @param color - When undefined (empty setting), omit `color` so theme markdown heading syntax colors apply. */
export function Heading3DecorationType(color?: string | ThemeColor) {
  return createHeadingDecoration(3, color);
}
/** @param color - When undefined (empty setting), omit `color` so theme markdown heading syntax colors apply. */
export function Heading4DecorationType(color?: string | ThemeColor) {
  return createHeadingDecoration(4, color);
}
/** @param color - When undefined (empty setting), omit `color` so theme markdown heading syntax colors apply. */
export function Heading5DecorationType(color?: string | ThemeColor) {
  return createHeadingDecoration(5, color);
}
/** @param color - When undefined (empty setting), omit `color` so theme markdown heading syntax colors apply. */
export function Heading6DecorationType(color?: string | ThemeColor) {
  return createHeadingDecoration(6, color);
}

/**
 * Creates a decoration type for link styling.
 *
 * Sets cursor to pointer on hover to indicate clickability.
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses textLink.foreground
 * @returns {vscode.TextEditorDecorationType} A decoration type for links
 */
export function LinkDecorationType(color?: string | ThemeColor) {
  const resolvedColor = color ?? new ThemeColor('textLink.foreground');
  return window.createTextEditorDecorationType({
    color: resolvedColor,
    textDecoration: 'underline',
    cursor: 'pointer',
    after: {
      contentText: ' 🔗',
      color: resolvedColor,
    },
  });
}

/**
 * Creates a decoration type for image styling.
 *
 * Adds an image icon after the image alt text to visually indicate it's an image.
 * Sets cursor to pointer on hover to indicate clickability (same as links).
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses textLink.foreground
 * @returns {vscode.TextEditorDecorationType} A decoration type for images
 */
export function ImageDecorationType(color?: string | ThemeColor) {
  const resolvedColor = color ?? new ThemeColor('textLink.foreground');
  return window.createTextEditorDecorationType({
    color: resolvedColor,
    cursor: 'pointer', // Show pointer cursor on hover (same as links)
    textDecoration: 'underline; text-decoration-style: dashed; text-decoration-thickness: 1px;',
    after: {
      contentText: ' ⬔',
      color: resolvedColor,
    },
  });
}

/**
 * Creates a decoration type for blockquote marker styling.
 *
 * Replaces '>' characters with a vertical blue bar.
 * Nested blockquotes automatically show multiple bars (one per '>').
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses textLink.foreground
 * @returns {vscode.TextEditorDecorationType} A decoration type for blockquote markers
 */
export function BlockquoteDecorationType(color?: string | ThemeColor) {
  const resolvedColor = color ?? new ThemeColor('textLink.foreground');
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: {
      contentText: '│',
      color: resolvedColor,
      fontWeight: 'bold',
    },
  });
}

/**
 * Creates a decoration type for unordered list item styling.
 *
 * Replaces unordered list markers (-, *, +) with a bullet point (•).
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses editor.foreground
 * @returns {vscode.TextEditorDecorationType} A decoration type for unordered list items
 */
export function ListItemDecorationType(color?: string | ThemeColor) {
  const resolvedColor = color ?? new ThemeColor('editor.foreground');
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: {
      contentText: '• ',
      fontWeight: 'bold',
      color: resolvedColor,
    },
  });
}

/**
 * Creates a decoration type for ordered list item marker styling.
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses editor.foreground
 * @returns {vscode.TextEditorDecorationType} A decoration type for ordered list item markers
 */
export function OrderedListItemDecorationType(color?: string | ThemeColor) {
  const resolvedColor = color ?? new ThemeColor('editor.foreground');
  return window.createTextEditorDecorationType({
    color: resolvedColor,
  });
}

/**
 * Creates a decoration type for horizontal rules (thematic breaks).
 *
 * Replaces ---, ***, or ___ with a visual horizontal line that spans the full editor width.
 * Uses border-bottom approach to prevent editor width expansion.
 * Hides the original text and shows only the border line.
 * Based on working implementation from examples/horizontal-line-working.
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color for the line; when undefined uses editorWidget.border
 * @returns {vscode.TextEditorDecorationType} A decoration type for horizontal rules
 */
export function HorizontalRuleDecorationType(color?: string | ThemeColor) {
  const resolvedColor = color ?? new ThemeColor('editorWidget.border');
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;', // Hide the original text (---, ***, ___)
    isWholeLine: true,
    borderWidth: '0 0 1px 0', // Only bottom border, 1px thick
    borderStyle: 'solid',
    borderColor: resolvedColor,
  });
}

/**
 * Creates a decoration type for unchecked checkbox styling.
 *
 * Replaces [ ] with an empty checkbox symbol (☐).
 * Click inside the brackets to toggle.
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses editor.foreground
 * @returns {vscode.TextEditorDecorationType} A decoration type for unchecked checkboxes
 */
export function CheckboxUncheckedDecorationType(color?: string | ThemeColor) {
  const resolvedColor = color ?? new ThemeColor('editor.foreground');
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;', // Hide the original [ ]
    before: {
      contentText: '☐',
      color: resolvedColor,
    },
  });
}

/**
 * Creates a decoration type for checked checkbox styling.
 *
 * Replaces [x] or [X] with a checked checkbox symbol (☑).
 * Click inside the brackets to toggle.
 *
 * @param {string | ThemeColor | undefined} color - Optional hex or theme color; when undefined uses editor.foreground
 * @returns {vscode.TextEditorDecorationType} A decoration type for checked checkboxes
 */
export function CheckboxCheckedDecorationType(color?: string | ThemeColor) {
  const resolvedColor = color ?? new ThemeColor('editor.foreground');
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;', // Hide the original [x]
    before: {
      contentText: '☑',
      color: resolvedColor,
    },
  });
}

/**
 * Creates a decoration type for table pipe characters (|).
 *
 * Hides the original pipe and renders a box-drawing vertical line (│) via
 * per-range `renderOptions.before.contentText`.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type for table pipes
 */
export function TablePipeDecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: {
      contentText: '',
      color: new ThemeColor('editorLineNumber.foreground'),
    },
  });
}

/**
 * Creates a decoration type for table separator row pipe characters.
 *
 * Hides the original pipe and renders a vertical line (│), same as data-row pipes,
 * via per-range `renderOptions.before.contentText`.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type for separator pipes
 */
export function TableSeparatorPipeDecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: {
      contentText: '',
      color: new ThemeColor('editorLineNumber.foreground'),
    },
  });
}

/**
 * Creates a decoration type for table separator row dash segments.
 *
 * Hides the original dashes and renders padded ASCII hyphen (`-`) runs via per-range
 * `renderOptions.before.contentText` (matches monospace width; avoids U+2500 misalignment).
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type for separator dashes
 */
export function TableSeparatorDashDecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: {
      contentText: '',
      color: new ThemeColor('editorLineNumber.foreground'),
    },
  });
}

/**
 * Creates a decoration type for table cell content.
 *
 * Hides the original cell text (with irregular spacing) and renders
 * uniformly padded content via per-range `renderOptions.before.contentText`.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type for table cells
 */
export function TableCellDecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: {
      contentText: '',
    },
  });
}

/**
 * Creates a decoration type for mermaid hover indicator.
 *
 * Adds a small visual indicator (⧉) at the start of mermaid code blocks
 * to signal that hovering will show a larger diagram preview.
 * The indicator uses a subtle color and cursor pointer to indicate interactivity.
 *
 * @returns {vscode.TextEditorDecorationType} A decoration type for mermaid hover indicator
 */
export function MermaidHoverIndicatorDecorationType() {
  return window.createTextEditorDecorationType({
    before: {
      contentText: '⧉',
      color: new ThemeColor('editor.foreground'),
      fontWeight: 'normal',
    },
    opacity: '0.2', // Apply opacity to the entire decoration
  });
}
