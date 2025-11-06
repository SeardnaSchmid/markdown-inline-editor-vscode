import { Range, TextEditor } from "vscode";
import {
  HideDecorationType,
  BoldDecorationType,
  ItalicDecorationType,
  BoldItalicDecorationType,
  StrikethroughDecorationType,
  CodeDecorationType,
  CodeBlockDecorationType,
  BlockquoteDecorationType,
  HeadingDecorationType,
  Heading1DecorationType,
  Heading2DecorationType,
  Heading3DecorationType,
  Heading4DecorationType,
  Heading5DecorationType,
  Heading6DecorationType,
  LinkDecorationType,
  ImageDecorationType,
  HorizontalRuleDecorationType,
  HighlightDecorationType,
} from "./decorations";
import { MarkdownParser } from "./parser";

type DecorationKey =
  | "hide"
  | "bold"
  | "italic"
  | "boldItalic"
  | "strikethrough"
  | "code"
  | "codeBlock"
  | "blockquote"
  | "heading"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "link"
  | "image"
  | "horizontalRule"
  | "highlight";

export class Decorator {
  activeEditor: TextEditor | undefined;
  private decorationsEnabled: boolean = true;
  private parser = new MarkdownParser();

  private decorationTypes: Record<DecorationKey, any>;

  constructor() {
    // Initialize decoration types for each key
    this.decorationTypes = {
      hide: HideDecorationType(),
      bold: BoldDecorationType(),
      italic: ItalicDecorationType(),
      boldItalic: BoldItalicDecorationType(),
      strikethrough: StrikethroughDecorationType(),
      code: CodeDecorationType(),
      codeBlock: CodeBlockDecorationType(),
      blockquote: BlockquoteDecorationType(),
      heading: HeadingDecorationType(),
      heading1: Heading1DecorationType(),
      heading2: Heading2DecorationType(),
      heading3: Heading3DecorationType(),
      heading4: Heading4DecorationType(),
      heading5: Heading5DecorationType(),
      heading6: Heading6DecorationType(),
      link: LinkDecorationType(),
      image: ImageDecorationType(),
      horizontalRule: HorizontalRuleDecorationType(),
      highlight: HighlightDecorationType(),
    };
  }

  setActiveEditor(textEditor: TextEditor | undefined) {
    if (!textEditor) {
      return;
    }
    this.activeEditor = textEditor;
    this.updateDecorations();
  }

  toggleDecorations(): void {
    this.decorationsEnabled = !this.decorationsEnabled;
    this.updateDecorations();
  }

  isDecorationsEnabled(): boolean {
    return this.decorationsEnabled;
  }

  updateDecorations() {
    if (!this.activeEditor) return;
    if (
      !["markdown", "md", "mdx"].includes(this.activeEditor.document.languageId)
    ) {
      return;
    }

    // If decorations are disabled, clear all decorations
    if (!this.decorationsEnabled) {
      this.clearAllDecorations();
      return;
    }

    // Initialize ranges for all decoration types
    const rangeMap = this.createEmptyRangeMap();

    const documentText = this.activeEditor.document.getText();
    const decorations = this.parser.extractDecorations(documentText);

    decorations.forEach((decoration) => {
      // Validate range positions before creating Range
      if (decoration.endPos <= decoration.startPos) {
        return; // Invalid range, skip
      }
      const range = this.createRange(decoration.startPos, decoration.endPos);
      if (!range) return;
      // Skip all decorations if the line is selected or range is selected
      if (this.isLineOfRangeSelected(range) || this.isRangeSelected(range)) {
        return;
      }

      // For horizontal rules, code blocks, and blockquotes, extend the range to span the full editor width
      if (
        (decoration.type === "horizontalRule" ||
          decoration.type === "codeBlock" ||
          decoration.type === "blockquote") &&
        this.activeEditor
      ) {
        if (decoration.type === "horizontalRule") {
          const line = this.activeEditor.document.lineAt(range.start.line);
          const fullLineRange = new Range(
            range.start.line,
            0,
            range.start.line,
            Math.max(line.text.length, 200)
          );
          rangeMap.horizontalRule.push(fullLineRange);
        } else if (
          decoration.type === "codeBlock" ||
          decoration.type === "blockquote"
        ) {
          // For code blocks and blockquotes, create a full-line decoration for each line in the block
          const startLine = range.start.line;
          let endLine = range.end.line;

          // If the range ends at the start of a line (column 0), don't include that line
          // This prevents including the line after the blockquote/code block
          if (range.end.character === 0 && endLine > startLine) {
            endLine--;
          }

          for (
            let lineNumber = startLine;
            lineNumber <= endLine;
            lineNumber++
          ) {
            const fullLineRange = new Range(
              lineNumber,
              0,
              lineNumber,
              Number.MAX_SAFE_INTEGER
            );
            if (decoration.type === "codeBlock") {
              rangeMap.codeBlock.push(fullLineRange);
            } else {
              rangeMap.blockquote.push(fullLineRange);
            }
          }
        }
      } else if (rangeMap[decoration.type as DecorationKey]) {
        rangeMap[decoration.type as DecorationKey].push(range);
      }
    });

    // Apply all decorations using forEach on the keys
    (Object.keys(this.decorationTypes) as DecorationKey[]).forEach((key) => {
      const ranges = rangeMap[key];
      if (ranges.length > 0) {
        this.activeEditor!.setDecorations(this.decorationTypes[key], ranges);
      }
    });
  }

  /**
   * Create an empty range map for all decoration types
   */
  private createEmptyRangeMap(): Record<DecorationKey, Range[]> {
    return {
      hide: [],
      bold: [],
      italic: [],
      boldItalic: [],
      strikethrough: [],
      code: [],
      codeBlock: [],
      blockquote: [],
      heading: [],
      heading1: [],
      heading2: [],
      heading3: [],
      heading4: [],
      heading5: [],
      heading6: [],
      link: [],
      image: [],
      horizontalRule: [],
      highlight: [],
    };
  }

  /**
   * Clear all decorations from the active editor
   */
  private clearAllDecorations(): void {
    if (!this.activeEditor) {
      return;
    }

    // Remove all decorations by setting empty ranges
    (Object.keys(this.decorationTypes) as DecorationKey[]).forEach((key) => {
      this.activeEditor!.setDecorations(this.decorationTypes[key], []);
    });
  }

  /**
   * Convert character positions to VS Code Range
   */
  private createRange(startPos: number, endPos: number): Range | null {
    if (!this.activeEditor) return null;

    // Validate positions are within document bounds
    const docLength = this.activeEditor.document.getText().length;
    if (
      startPos < 0 ||
      endPos < 0 ||
      startPos > docLength ||
      endPos > docLength
    ) {
      return null;
    }
    if (endPos <= startPos) {
      return null; // Invalid range
    }

    try {
      const start = this.activeEditor.document.positionAt(startPos);
      const end = this.activeEditor.document.positionAt(endPos);

      // Validate the range is valid
      if (start.isAfter(end)) {
        return null;
      }

      return new Range(start, end);
    } catch (error) {
      // Invalid position
      return null;
    }
  }

  /**
   * Check if a range is currently selected
   */
  private isRangeSelected(range: Range): boolean {
    return !!this.activeEditor?.selections.find((s) => range.intersection(s));
  }

  /**
   * Check if any part of a range's line is selected
   */
  private isLineOfRangeSelected(range: Range): boolean {
    return !!this.activeEditor?.selections.find(
      (s) => !(range.end.line < s.start.line || range.start.line > s.end.line)
    );
  }
}
