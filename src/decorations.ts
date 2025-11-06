import { DecorationRangeBehavior, ThemeColor, window } from "vscode";

export function HideDecorationType() {
  return window.createTextEditorDecorationType({
    // Hide the item
    textDecoration: "none; display: none;",
    // This forces the editor to re-layout following text correctly
    after: {
      contentText: "",
    },
  });
}

export function BoldDecorationType() {
  return window.createTextEditorDecorationType({
    fontWeight: "bold",
  });
}

export function ItalicDecorationType() {
  return window.createTextEditorDecorationType({
    fontStyle: "italic",
  });
}

export function BoldItalicDecorationType() {
  return window.createTextEditorDecorationType({
    fontWeight: "bold",
    fontStyle: "italic",
  });
}

export function StrikethroughDecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: "line-through",
  });
}

export function CodeDecorationType() {
  // For inline code (`code`)
  // Using before/after pseudo-elements as workaround for VS Code limitation where backgroundColor
  // doesn't render consistently on adjacent inline decorations.
  // The invisible before/after elements force separate rendering boxes while the main backgroundColor styles the code.
  return window.createTextEditorDecorationType({
    // Invisible before element - present to force rendering but not visible
    before: {
      contentText: "", // Empty content
      width: "0px", // Zero width - invisible
      height: "0px", // Zero height - invisible
    },
    // Invisible after element - present to force rendering but not visible
    after: {
      contentText: "", // Empty content
      width: "0px", // Zero width - invisible
      height: "0px", // Zero height - invisible
    },
    // Style the actual code text
    color: new ThemeColor("foreground"),
    // Use textCodeBlock.background which is theme-aware and slightly different from editor background
    // Alternative options if this is too similar:
    // - editorWidget.background (slightly different, used for widgets)
    // - input.background (input field background, usually distinct)
    backgroundColor: new ThemeColor("textCodeBlock.background"),
    borderRadius: "3px",
    isWholeLine: false, // Explicitly set to false for inline decorations
    rangeBehavior: DecorationRangeBehavior.ClosedClosed, // Ensures decoration persists when range changes (e.g., line wrapping)
  });
}

export function CodeBlockDecorationType() {
  // For fenced code blocks (```code```)
  // Whole-line decoration with proper styling for code blocks
  // Note: For isWholeLine decorations, before/after pseudo-elements are not needed
  // and can interfere with rendering. The whole-line decoration handles the background automatically.
  // We don't set the 'color' property to preserve VS Code's built-in syntax highlighting.
  return window.createTextEditorDecorationType({
    // Only set background color - don't override text color to preserve syntax highlighting
    // Use textCodeBlock.background which is theme-aware and slightly different from editor background
    // Alternative options if this is too similar:
    // - editorWidget.background (slightly different, used for widgets)
    // - input.background (input field background, usually distinct)
    backgroundColor: new ThemeColor("textCodeBlock.background"),
    borderRadius: "3px",
    isWholeLine: true, // Full line coverage for code blocks - extends to viewport edge
    rangeBehavior: DecorationRangeBehavior.ClosedClosed, // Ensures decoration persists when range changes (e.g., line wrapping)
  });
}

export function BlockquoteDecorationType() {
  // For blockquotes (> quote)
  // Single level only - all blockquotes are treated the same
  return window.createTextEditorDecorationType({
    // Use input.background which is more distinct from editor background
    // Alternative: editorWidget.background (might be too similar to editor background)
    backgroundColor: new ThemeColor("input.background"),
    borderWidth: "0 0 0 0.33em", // Left border only, width is ~5px at 16px font size but scales with zoom
    borderColor: new ThemeColor("editorWidget.border"),
    borderStyle: "solid",
    // Add left padding to offset text from the border
    // Using before element for padding - this should work with whole-line decorations
    before: {
      contentText: "",
      width: "2ch", // Padding between border and text
    },
    isWholeLine: true,
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  });
}

export function HeadingDecorationType() {
  return window.createTextEditorDecorationType({
    color: new ThemeColor("foreground"),
    fontWeight: "bold",
  });
}

export function Heading1DecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: "none; font-size: 200%;",
    fontWeight: "bold",
  });
}

export function Heading2DecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: "none; font-size: 150%;",
    fontWeight: "bold",
  });
}

export function Heading3DecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: "none; font-size: 110%;",
    fontWeight: "bold",
  });
}

export function Heading4DecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: "none; font-size: 100%;",
    color: new ThemeColor("descriptionForeground"),
  });
}

export function Heading5DecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: "none; font-size: 90%;",
    color: new ThemeColor("descriptionForeground"),
  });
}

export function Heading6DecorationType() {
  return window.createTextEditorDecorationType({
    textDecoration: "none; font-size: 80%;",
    color: new ThemeColor("descriptionForeground"),
  });
}

export function LinkDecorationType() {
  return window.createTextEditorDecorationType({
    color: new ThemeColor("textLink.foreground"),
    textDecoration: "underline",
  });
}

export function ImageDecorationType() {
  return window.createTextEditorDecorationType({
    color: new ThemeColor("textLink.foreground"),
    fontStyle: "italic",
  });
}

export function HorizontalRuleDecorationType() {
  // For horizontal rules (---, ***, or ___)
  // Similar to blockquote but with bottom border instead of left border
  return window.createTextEditorDecorationType({
    // Hide the original dashes completely
    textDecoration: "none; display: none;",
    borderWidth: "0 0 0.1em 0", // Bottom border only, width is ~1.6px at 16px font size but scales with zoom
    borderColor: new ThemeColor("editorWidget.border"),
    borderStyle: "solid",
    isWholeLine: true,
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  });
}

export function HighlightDecorationType() {
  // For highlighted text (==text==)
  // Using before/after pseudo-elements as workaround for VS Code limitation where backgroundColor
  // doesn't render consistently on adjacent inline decorations.
  // The invisible before/after elements force separate rendering boxes while the main backgroundColor styles the highlight.
  return window.createTextEditorDecorationType({
    // Invisible before element - present to force rendering but not visible
    before: {
      contentText: "", // Empty content
      width: "0px", // Zero width - invisible
      height: "0px", // Zero height - invisible
    },
    // Invisible after element - present to force rendering but not visible
    after: {
      contentText: "", // Empty content
      width: "0px", // Zero width - invisible
      height: "0px", // Zero height - invisible
    },
    // Style the actual highlighted text
    backgroundColor: "rgba(255, 255, 0, 0.3)", // Semi-transparent yellow
    borderRadius: "3px",
    isWholeLine: false, // Explicitly set to false for inline decorations
    rangeBehavior: DecorationRangeBehavior.ClosedClosed, // Ensures decoration persists when range changes (e.g., line wrapping)
  });
}
