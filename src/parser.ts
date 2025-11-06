import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import {
  Root,
  Heading,
  InlineCode,
  Code,
  Node,
  Strong,
  Emphasis,
  Delete,
  Link,
  Image,
  LinkReference,
  ImageReference,
} from "mdast";

export interface DecorationRange {
  startPos: number;
  endPos: number;
  type:
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
  level?: number; // For headings
}

/**
 * Represents a node with valid position information
 */
interface PositionedNode {
  position: {
    start: { offset: number };
    end: { offset: number };
  };
}

/**
 * Interface for node handlers that extract decorations from AST nodes
 * Follows Strategy pattern for extensibility (OCP)
 */
interface NodeHandler {
  /**
   * Check if this handler can process the given node type
   */
  canHandle(node: Node): boolean;

  /**
   * Extract decoration ranges from the node
   * @param node - The AST node to process
   * @param text - The full source text for position calculations
   * @returns Array of decoration ranges extracted from the node
   */
  extractDecorations(node: Node, text: string): DecorationRange[];
}

/**
 * Base class for node handlers with common position validation
 */
abstract class BaseNodeHandler implements NodeHandler {
  /**
   * Check if node has valid position information
   */
  protected hasValidPosition(node: Node): node is Node & PositionedNode {
    return (
      !!node.position &&
      node.position.start.offset !== undefined &&
      node.position.start.offset !== null &&
      node.position.end.offset !== undefined &&
      node.position.end.offset !== null
    );
  }

  abstract canHandle(node: Node): boolean;
  abstract extractDecorations(node: Node, text: string): DecorationRange[];
}

/**
 * Handler for heading nodes (H1-H6)
 */
class HeadingHandler extends BaseNodeHandler {
  private readonly HEADING_MARKER_PATTERN = /^(\s*)(#{1,6})(\s+)/;

  canHandle(node: Node): boolean {
    return node.type === "heading";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const headingNode = node as Heading;
    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    const headingText = text.substring(startOffset, endOffset);
    const markerMatch = headingText.match(this.HEADING_MARKER_PATTERN);

    if (!this.isValidMarkerMatch(markerMatch)) {
      // Check if heading is essentially empty (just marker with no content)
      if (this.isHeadingEmpty(text, startOffset, endOffset)) {
        return [];
      }
      return this.createFallbackDecoration(startOffset, endOffset);
    }

    // Check if heading has any content (not just whitespace)
    const contentStart = this.getContentStart(markerMatch, startOffset);
    if (
      contentStart >= endOffset ||
      this.isEmptyContent(text, contentStart, endOffset)
    ) {
      // Empty heading - don't decorate to avoid making it invisible
      return [];
    }

    const decorations = this.createMarkerDecoration(markerMatch, startOffset);
    decorations.push(
      this.createContentDecoration(
        markerMatch,
        startOffset,
        endOffset,
        headingNode.depth
      )
    );

    return decorations;
  }

  private isValidMarkerMatch(
    match: RegExpMatchArray | null
  ): match is RegExpMatchArray & [string, string, string, string] {
    return (
      match !== null &&
      match[1] !== undefined &&
      match[2] !== undefined &&
      match[3] !== undefined
    );
  }

  private createMarkerDecoration(
    markerMatch: RegExpMatchArray & [string, string, string, string],
    startOffset: number
  ): DecorationRange[] {
    const leadingWhitespace = markerMatch[1].length;
    const markerLength = markerMatch[2].length;
    const spaceAfterMarker = markerMatch[3].length;

    const markerStart = startOffset + leadingWhitespace;
    const markerEnd = markerStart + markerLength + spaceAfterMarker;

    return [
      {
        type: "hide",
        startPos: markerStart,
        endPos: markerEnd,
      },
    ];
  }

  private createContentDecoration(
    markerMatch: RegExpMatchArray & [string, string, string, string],
    startOffset: number,
    endOffset: number,
    depth: number
  ): DecorationRange {
    const leadingWhitespace = markerMatch[1].length;
    const markerLength = markerMatch[2].length;
    const spaceAfterMarker = markerMatch[3].length;
    const markerStart = startOffset + leadingWhitespace;
    const markerEnd = markerStart + markerLength + spaceAfterMarker;

    return {
      startPos: markerEnd,
      endPos: endOffset,
      type: this.getHeadingType(depth),
      level: depth,
    };
  }

  private getHeadingType(depth: number): DecorationRange["type"] {
    const headingTypeMap: Record<number, DecorationRange["type"]> = {
      1: "heading1",
      2: "heading2",
      3: "heading3",
      4: "heading4",
      5: "heading5",
      6: "heading6",
    };
    return headingTypeMap[depth] ?? "heading";
  }

  private getContentStart(
    markerMatch: RegExpMatchArray & [string, string, string, string],
    startOffset: number
  ): number {
    const leadingWhitespace = markerMatch[1].length;
    const markerLength = markerMatch[2].length;
    const spaceAfterMarker = markerMatch[3].length;
    return startOffset + leadingWhitespace + markerLength + spaceAfterMarker;
  }

  private isEmptyContent(
    text: string,
    contentStart: number,
    endOffset: number
  ): boolean {
    if (contentStart >= endOffset) {
      return true;
    }
    const content = text.substring(contentStart, endOffset);
    return content.trim().length === 0;
  }

  /**
   * Check if heading is empty (just marker like "#" or "##" with no meaningful content)
   */
  private isHeadingEmpty(
    text: string,
    startOffset: number,
    endOffset: number
  ): boolean {
    const headingText = text.substring(startOffset, endOffset).trim();
    // Match patterns like "#", "##", "###", etc. with optional leading/trailing whitespace
    const emptyHeadingPattern = /^\s*#{1,6}\s*$/;
    return emptyHeadingPattern.test(headingText);
  }

  private createFallbackDecoration(
    startOffset: number,
    endOffset: number
  ): DecorationRange[] {
    return [
      {
        type: "hide",
        startPos: startOffset,
        endPos: endOffset,
      },
    ];
  }
}

/**
 * Handler for horizontal rule nodes (thematic breaks)
 */
class HorizontalRuleHandler extends BaseNodeHandler {
  canHandle(node: Node): boolean {
    return node.type === "thematicBreak";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    // Hide the entire horizontal rule marker (---, ***, or ___)
    // and create a decoration for the horizontal rule itself
    const decorations: DecorationRange[] = [
      {
        type: "hide",
        startPos: startOffset,
        endPos: endOffset,
      },
      {
        type: "horizontalRule",
        startPos: startOffset,
        endPos: endOffset,
      },
    ];

    return decorations;
  }
}

/**
 * Handler for fenced code block nodes (```code```)
 */
class CodeBlockHandler extends BaseNodeHandler {
  canHandle(node: Node): boolean {
    return node.type === "code";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    // Find the opening and closing fence markers (```)
    // The fence could be 3 or more backticks
    const codeText = text.substring(startOffset, endOffset);
    const fenceMatch = codeText.match(/^(```+)(.*?)(```+)$/s);

    if (!fenceMatch) {
      // Fallback: if no fence found, treat entire range as code
      return [
        {
          type: "code",
          startPos: startOffset,
          endPos: endOffset,
        },
      ];
    }

    const openingFence = fenceMatch[1];
    const closingFence = fenceMatch[3];

    if (!openingFence || !closingFence) {
      // Fallback: if fence parts not found, treat entire range as code
      return [
        {
          type: "code",
          startPos: startOffset,
          endPos: endOffset,
        },
      ];
    }

    const fenceLength = openingFence.length;

    // Find closing fence - it should be at the end
    const closingFenceStart = endOffset - closingFence.length;

    // Calculate content range (after opening fence and language identifier, before closing fence)
    // This will skip the opening fence, language identifier (if present), and any whitespace/newlines
    const openingFenceEnd = startOffset + fenceLength;
    const contentStart = this.findContentStart(
      text,
      openingFenceEnd,
      closingFenceStart
    );
    const contentEnd = this.findContentEnd(
      text,
      openingFenceEnd,
      closingFenceStart
    );

    const decorations: DecorationRange[] = [
      // Hide opening fence and language identifier (everything up to content start)
      {
        type: "hide",
        startPos: startOffset,
        endPos: contentStart,
      },
      // Hide closing fence
      {
        type: "hide",
        startPos: closingFenceStart,
        endPos: endOffset,
      },
    ];

    // Add codeBlock decoration for the entire block (including fence lines)
    // This ensures the background color covers the opening fence, content, and closing fence lines
    // The fence markers themselves are hidden but their lines get the background color
    decorations.push({
      type: "codeBlock",
      startPos: startOffset,
      endPos: endOffset,
    });

    return decorations;
  }

  private findContentStart(
    text: string,
    afterFence: number,
    beforeClosing: number
  ): number {
    // Skip language identifier and whitespace/newlines after opening fence
    // Format: ```language\n or ```language \n or ```\n
    let pos = afterFence;

    // Skip whitespace (spaces/tabs) after fence
    while (pos < beforeClosing && (text[pos] === " " || text[pos] === "\t")) {
      pos++;
    }

    // Skip language identifier (any non-whitespace, non-newline characters)
    while (
      pos < beforeClosing &&
      text[pos] !== "\n" &&
      text[pos] !== "\r" &&
      text[pos] !== " " &&
      text[pos] !== "\t"
    ) {
      pos++;
    }

    // Skip any remaining whitespace after language identifier
    while (pos < beforeClosing && (text[pos] === " " || text[pos] === "\t")) {
      pos++;
    }

    // Skip newlines after opening fence/language identifier
    while (pos < beforeClosing && (text[pos] === "\n" || text[pos] === "\r")) {
      pos++;
    }

    return pos;
  }

  private findContentEnd(
    text: string,
    afterFence: number,
    beforeClosing: number
  ): number {
    // Skip newline before closing fence if present
    let pos = beforeClosing;
    while (
      pos > afterFence &&
      (text[pos - 1] === "\n" || text[pos - 1] === "\r")
    ) {
      pos--;
    }
    return pos;
  }
}

/**
 * Handler for blockquote nodes (> quote)
 */
class BlockquoteHandler extends BaseNodeHandler {
  private readonly BLOCKQUOTE_MARKER_PATTERN = /^(\s*)(>+)(\s*)/;

  canHandle(node: Node): boolean {
    return node.type === "blockquote";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    const decorations: DecorationRange[] = [];

    // Find the actual line boundaries in the source text
    // We need to go backwards to find the start of the first line that contains this blockquote
    let actualStart = startOffset;
    while (
      actualStart > 0 &&
      text[actualStart - 1] !== "\n" &&
      text[actualStart - 1] !== "\r"
    ) {
      actualStart--;
    }

    // Process the blockquote text to hide all `>` markers on each line
    let pos = actualStart;

    while (pos < endOffset) {
      // Find the start of the current line
      const lineStart = pos;

      // Find the end of the current line (next newline or end of blockquote)
      let lineEnd = pos;
      while (
        lineEnd < endOffset &&
        text[lineEnd] !== "\n" &&
        text[lineEnd] !== "\r"
      ) {
        lineEnd++;
      }

      // Get the line content (excluding newline)
      const lineText = text.substring(lineStart, lineEnd);

      // Match the blockquote marker pattern: optional whitespace, one or more `>`, optional whitespace
      const match = lineText.match(this.BLOCKQUOTE_MARKER_PATTERN);

      if (
        match &&
        match[1] !== undefined &&
        match[2] !== undefined &&
        match[3] !== undefined
      ) {
        const leadingWhitespace = match[1].length;
        const markerLength = match[2].length;
        const trailingWhitespace = match[3].length;

        // Hide the entire marker (whitespace + `>` + optional whitespace)
        const markerStart = lineStart + leadingWhitespace;
        const markerEnd = markerStart + markerLength + trailingWhitespace;

        if (markerEnd > markerStart) {
          decorations.push({
            type: "hide",
            startPos: markerStart,
            endPos: markerEnd,
          });
        }
      }

      // Move to next line (skip newline character(s))
      pos = lineEnd;
      if (pos < endOffset && text[pos] === "\r") {
        pos++; // Skip \r
      }
      if (pos < endOffset && text[pos] === "\n") {
        pos++; // Skip \n
      }
    }

    // Add blockquote decoration for the entire block (single level only)
    // Use actualStart to ensure we cover the lines with `>` markers
    // Use endOffset directly - don't extend beyond the AST node's end
    // The AST node's endOffset already points to the correct end of the blockquote
    decorations.push({
      type: "blockquote",
      startPos: actualStart,
      endPos: endOffset,
    });

    return decorations;
  }
}

/**
 * Handler for inline code nodes
 */
class InlineCodeHandler extends BaseNodeHandler {
  private readonly BACKTICK_LENGTH = 1;

  canHandle(node: Node): boolean {
    return node.type === "inlineCode";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    const decorations: DecorationRange[] = [
      this.createOpeningBacktickDecoration(startOffset),
      this.createClosingBacktickDecoration(endOffset),
      this.createCodeContentDecoration(startOffset, endOffset),
    ];

    return decorations;
  }

  private createOpeningBacktickDecoration(
    startOffset: number
  ): DecorationRange {
    return {
      type: "hide",
      startPos: startOffset,
      endPos: startOffset + this.BACKTICK_LENGTH,
    };
  }

  private createClosingBacktickDecoration(endOffset: number): DecorationRange {
    return {
      type: "hide",
      startPos: endOffset - this.BACKTICK_LENGTH,
      endPos: endOffset,
    };
  }

  private createCodeContentDecoration(
    startOffset: number,
    endOffset: number
  ): DecorationRange {
    const contentStart = startOffset + this.BACKTICK_LENGTH;
    const contentEnd = endOffset - this.BACKTICK_LENGTH;

    // Ensure we have valid content (at least 1 character between backticks)
    if (contentEnd <= contentStart) {
      // Empty or invalid inline code, return empty range that will be filtered out
      return {
        type: "code",
        startPos: contentStart,
        endPos: contentStart + 1, // Minimum valid range
      };
    }

    return {
      type: "code",
      startPos: contentStart,
      endPos: contentEnd,
    };
  }
}

/**
 * Handler for strong nodes (bold: **text** or __text__)
 */
class StrongHandler extends BaseNodeHandler {
  canHandle(node: Node): boolean {
    return node.type === "strong";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;
    const strongNode = node as Strong;

    // Check if this strong node contains emphasis (bold-italic)
    const hasEmphasis = this.hasEmphasisChild(strongNode);

    if (hasEmphasis) {
      // Handle bold-italic: process emphasis children as boldItalic
      return this.extractBoldItalicDecorations(
        strongNode,
        text,
        startOffset,
        endOffset
      );
    }

    // Regular bold: hide delimiters and apply bold decoration
    return this.extractBoldDecorations(text, startOffset, endOffset);
  }

  private hasEmphasisChild(node: Strong): boolean {
    if (!node.children) {
      return false;
    }
    return node.children.some((child) => child.type === "emphasis");
  }

  private extractBoldDecorations(
    text: string,
    startOffset: number,
    endOffset: number
  ): DecorationRange[] {
    // Find the delimiter pattern (either ** or __)
    const nodeText = text.substring(startOffset, endOffset);
    const asteriskMatch = nodeText.match(/^(\*\*)(.+?)(\*\*)$/s);
    const underscoreMatch = nodeText.match(/^(__)(.+?)(__)$/s);

    let delimiterLength = 2; // Default to 2 for ** or __
    if (asteriskMatch && asteriskMatch[1]) {
      delimiterLength = asteriskMatch[1].length;
    } else if (underscoreMatch && underscoreMatch[1]) {
      delimiterLength = underscoreMatch[1].length;
    }

    const contentStart = startOffset + delimiterLength;
    const contentEnd = endOffset - delimiterLength;

    return [
      // Hide opening delimiter
      {
        type: "hide",
        startPos: startOffset,
        endPos: startOffset + delimiterLength,
      },
      // Hide closing delimiter
      {
        type: "hide",
        startPos: endOffset - delimiterLength,
        endPos: endOffset,
      },
      // Apply bold decoration to content
      {
        type: "bold",
        startPos: contentStart,
        endPos: contentEnd,
      },
    ];
  }

  private extractBoldItalicDecorations(
    node: Strong,
    text: string,
    startOffset: number,
    endOffset: number
  ): DecorationRange[] {
    const decorations: DecorationRange[] = [];

    // Hide the outer delimiters (*** or ___)
    const nodeText = text.substring(startOffset, endOffset);
    const tripleAsteriskMatch = nodeText.match(/^(\*\*\*)(.+?)(\*\*\*)$/s);
    const tripleUnderscoreMatch = nodeText.match(/^(___)(.+?)(___)$/s);

    let outerDelimiterLength = 3; // Default to 3 for *** or ___
    if (tripleAsteriskMatch && tripleAsteriskMatch[1]) {
      outerDelimiterLength = tripleAsteriskMatch[1].length;
    } else if (tripleUnderscoreMatch && tripleUnderscoreMatch[1]) {
      outerDelimiterLength = tripleUnderscoreMatch[1].length;
    }

    decorations.push({
      type: "hide",
      startPos: startOffset,
      endPos: startOffset + outerDelimiterLength,
    });
    decorations.push({
      type: "hide",
      startPos: endOffset - outerDelimiterLength,
      endPos: endOffset,
    });

    // Process children to find emphasis nodes and apply boldItalic
    if (node.children) {
      this.processChildrenForBoldItalic(node.children, text, decorations);
    }

    return decorations;
  }

  private processChildrenForBoldItalic(
    children: Node[],
    text: string,
    decorations: DecorationRange[]
  ): void {
    for (const child of children) {
      if (child.type === "emphasis" && this.hasValidPosition(child)) {
        const emphasisStart = child.position.start.offset!;
        const emphasisEnd = child.position.end.offset!;

        // Hide emphasis delimiters (* or _)
        const emphasisText = text.substring(emphasisStart, emphasisEnd);
        const singleAsteriskMatch = emphasisText.match(/^(\*)(.+?)(\*)$/s);
        const singleUnderscoreMatch = emphasisText.match(/^(_)(.+?)(_)$/s);

        let delimiterLength = 1;
        if (singleAsteriskMatch && singleAsteriskMatch[1]) {
          delimiterLength = singleAsteriskMatch[1].length;
        } else if (singleUnderscoreMatch && singleUnderscoreMatch[1]) {
          delimiterLength = singleUnderscoreMatch[1].length;
        }

        decorations.push({
          type: "hide",
          startPos: emphasisStart,
          endPos: emphasisStart + delimiterLength,
        });
        decorations.push({
          type: "hide",
          startPos: emphasisEnd - delimiterLength,
          endPos: emphasisEnd,
        });
        decorations.push({
          type: "boldItalic",
          startPos: emphasisStart + delimiterLength,
          endPos: emphasisEnd - delimiterLength,
        });
      } else if (this.hasValidPosition(child)) {
        // For non-emphasis children, apply bold
        const childStart = child.position.start.offset!;
        const childEnd = child.position.end.offset!;
        decorations.push({
          type: "bold",
          startPos: childStart,
          endPos: childEnd,
        });
      }
    }
  }
}

/**
 * Handler for emphasis nodes (italic: *text* or _text_)
 */
class EmphasisHandler extends BaseNodeHandler {
  canHandle(node: Node): boolean {
    return node.type === "emphasis";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    // Check if this emphasis is part of bold-italic (***text*** or ___text___)
    // If the surrounding text has triple delimiters, skip because StrongHandler will handle it
    const beforeText = text.substring(
      Math.max(0, startOffset - 2),
      startOffset
    );
    const afterText = text.substring(
      endOffset,
      Math.min(text.length, endOffset + 2)
    );

    // Check for triple asterisk pattern: ***text***
    if (beforeText === "**" && afterText === "**") {
      // This is part of bold-italic, skip it (StrongHandler will handle it)
      return [];
    }
    // Check for triple underscore pattern: ___text___
    if (beforeText === "__" && afterText === "__") {
      // This is part of bold-italic, skip it (StrongHandler will handle it)
      return [];
    }

    // Regular italic: hide delimiters and apply italic decoration
    const nodeText = text.substring(startOffset, endOffset);
    const asteriskMatch = nodeText.match(/^(\*)(.+?)(\*)$/s);
    const underscoreMatch = nodeText.match(/^(_)(.+?)(_)$/s);

    let delimiterLength = 1; // Default to 1 for * or _
    if (asteriskMatch && asteriskMatch[1]) {
      delimiterLength = asteriskMatch[1].length;
    } else if (underscoreMatch && underscoreMatch[1]) {
      delimiterLength = underscoreMatch[1].length;
    }

    const contentStart = startOffset + delimiterLength;
    const contentEnd = endOffset - delimiterLength;

    return [
      // Hide opening delimiter
      {
        type: "hide",
        startPos: startOffset,
        endPos: startOffset + delimiterLength,
      },
      // Hide closing delimiter
      {
        type: "hide",
        endPos: endOffset,
        startPos: endOffset - delimiterLength,
      },
      // Apply italic decoration to content
      {
        type: "italic",
        startPos: contentStart,
        endPos: contentEnd,
      },
    ];
  }
}

/**
 * Handler for delete nodes (strikethrough: ~~text~~)
 * Requires remark-gfm plugin
 */
class DeleteHandler extends BaseNodeHandler {
  canHandle(node: Node): boolean {
    return node.type === "delete";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    // Hide delimiters (~~)
    const contentStart = startOffset + 2;
    const contentEnd = endOffset - 2;

    if (contentEnd <= contentStart) {
      return [];
    }

    return [
      // Hide opening delimiter
      {
        type: "hide",
        startPos: startOffset,
        endPos: startOffset + 2,
      },
      // Hide closing delimiter
      {
        type: "hide",
        startPos: endOffset - 2,
        endPos: endOffset,
      },
      // Apply strikethrough decoration to content
      {
        type: "strikethrough",
        startPos: contentStart,
        endPos: contentEnd,
      },
    ];
  }
}

/**
 * Handler for link nodes (inline links: [text](url) and auto-links: <url>)
 */
class LinkHandler extends BaseNodeHandler {
  canHandle(node: Node): boolean {
    return node.type === "link";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const linkNode = node as Link;
    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    const decorations: DecorationRange[] = [];

    // Check if this is an auto-link (<url>)
    // Auto-links are typically parsed as Link nodes where the source has angle brackets
    // around the node position. We check both cases: brackets included or excluded.
    const beforeChar = startOffset > 0 ? text[startOffset - 1] : "";
    const afterChar = endOffset < text.length ? text[endOffset] : "";
    const nodeStartChar = startOffset < text.length ? text[startOffset] : "";
    const nodeEndChar = endOffset > 0 ? text[endOffset - 1] : "";

    // Case 1: Brackets are outside the node position (<url>)
    if (beforeChar === "<" && afterChar === ">") {
      // Auto-link: hide angle brackets and apply link decoration to URL
      decorations.push({
        type: "hide",
        startPos: startOffset - 1,
        endPos: startOffset,
      });
      decorations.push({
        type: "hide",
        startPos: endOffset,
        endPos: endOffset + 1,
      });
      decorations.push({
        type: "link",
        startPos: startOffset,
        endPos: endOffset,
      });
      return decorations;
    }

    // Case 2: Brackets are inside the node position (node position includes < and >)
    if (nodeStartChar === "<" && nodeEndChar === ">") {
      // Auto-link: hide angle brackets and apply link decoration to URL
      decorations.push({
        type: "hide",
        startPos: startOffset,
        endPos: startOffset + 1,
      });
      decorations.push({
        type: "hide",
        startPos: endOffset - 1,
        endPos: endOffset,
      });
      decorations.push({
        type: "link",
        startPos: startOffset + 1,
        endPos: endOffset - 1,
      });
      return decorations;
    }

    // Regular inline link: [text](url "title")
    // The AST node position should include the entire link syntax
    // Find the brackets and parentheses in the source text
    const linkText = text.substring(startOffset, endOffset);

    // Check if this starts with a bracket (should be for inline links)
    if (linkText[0] !== "[") {
      // Doesn't start with bracket, might not be a standard inline link
      return [];
    }

    const bracketStart = startOffset;

    // Find closing bracket ]
    let bracketEnd = bracketStart + 1;
    while (bracketEnd < endOffset && text[bracketEnd] !== "]") {
      bracketEnd++;
    }

    if (bracketEnd >= endOffset) {
      // No closing bracket found
      return [];
    }

    // Find opening parenthesis ( - should be right after closing bracket or with whitespace
    let parenStart = bracketEnd + 1;
    while (parenStart < endOffset && text[parenStart] !== "(") {
      if (
        text[parenStart] !== " " &&
        text[parenStart] !== "\n" &&
        text[parenStart] !== "\r"
      ) {
        // No opening paren found, might be reference-style (handled separately)
        return [];
      }
      parenStart++;
    }

    if (parenStart >= endOffset) {
      // No opening parenthesis found
      return [];
    }

    // Find closing parenthesis ) - handle nested parentheses
    let parenEnd = parenStart + 1;
    let parenDepth = 1;
    while (parenEnd < endOffset && parenDepth > 0) {
      if (text[parenEnd] === "(") {
        parenDepth++;
      } else if (text[parenEnd] === ")") {
        parenDepth--;
      }
      parenEnd++;
    }

    if (bracketStart < bracketEnd && parenStart < parenEnd) {
      // Hide opening bracket
      decorations.push({
        type: "hide",
        startPos: bracketStart,
        endPos: bracketStart + 1,
      });

      // Hide closing bracket
      decorations.push({
        type: "hide",
        startPos: bracketEnd,
        endPos: bracketEnd + 1,
      });

      // Hide entire parentheses and URL (and title if present)
      decorations.push({
        type: "hide",
        startPos: parenStart,
        endPos: parenEnd,
      });

      // Apply link decoration to the text content (between brackets)
      const textStart = bracketStart + 1;
      const textEnd = bracketEnd;
      if (textEnd > textStart) {
        decorations.push({
          type: "link",
          startPos: textStart,
          endPos: textEnd,
        });
      }
    }

    return decorations;
  }
}

/**
 * Handler for image nodes (inline images: ![alt](url))
 */
class ImageHandler extends BaseNodeHandler {
  canHandle(node: Node): boolean {
    return node.type === "image";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const imageNode = node as Image;
    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    const decorations: DecorationRange[] = [];

    // Find the !, brackets, and parentheses in the source text
    // The AST node position should include the entire image syntax
    const imageText = text.substring(startOffset, endOffset);

    // Check if this starts with exclamation mark (should be for images)
    if (imageText[0] !== "!") {
      // Doesn't start with !, might not be a standard image
      return [];
    }

    const exclamationStart = startOffset;
    const bracketStart = startOffset + 1;

    // Check if bracket is at expected position
    if (bracketStart >= endOffset || text[bracketStart] !== "[") {
      return [];
    }

    // Find closing bracket ]
    let bracketEnd = bracketStart + 1;
    while (bracketEnd < endOffset && text[bracketEnd] !== "]") {
      bracketEnd++;
    }

    if (bracketEnd >= endOffset) {
      // No closing bracket found
      return [];
    }

    // Find opening parenthesis ( - should be right after closing bracket or with whitespace
    let parenStart = bracketEnd + 1;
    while (parenStart < endOffset && text[parenStart] !== "(") {
      if (
        text[parenStart] !== " " &&
        text[parenStart] !== "\n" &&
        text[parenStart] !== "\r"
      ) {
        // No opening paren found, might be reference-style (handled separately)
        return [];
      }
      parenStart++;
    }

    if (parenStart >= endOffset) {
      // No opening parenthesis found
      return [];
    }

    // Find closing parenthesis ) - handle nested parentheses
    let parenEnd = parenStart + 1;
    let parenDepth = 1;
    while (parenEnd < endOffset && parenDepth > 0) {
      if (text[parenEnd] === "(") {
        parenDepth++;
      } else if (text[parenEnd] === ")") {
        parenDepth--;
      }
      parenEnd++;
    }

    if (
      exclamationStart < bracketStart &&
      bracketStart < bracketEnd &&
      parenStart < parenEnd
    ) {
      // Hide exclamation mark
      decorations.push({
        type: "hide",
        startPos: exclamationStart,
        endPos: exclamationStart + 1,
      });

      // Hide opening bracket
      decorations.push({
        type: "hide",
        startPos: bracketStart,
        endPos: bracketStart + 1,
      });

      // Hide closing bracket
      decorations.push({
        type: "hide",
        startPos: bracketEnd,
        endPos: bracketEnd + 1,
      });

      // Hide entire parentheses and URL (and title if present)
      decorations.push({
        type: "hide",
        startPos: parenStart,
        endPos: parenEnd,
      });

      // Apply image decoration to the alt text (between brackets)
      const altStart = bracketStart + 1;
      const altEnd = bracketEnd;
      if (altEnd > altStart) {
        decorations.push({
          type: "image",
          startPos: altStart,
          endPos: altEnd,
        });
      }
    }

    return decorations;
  }
}

/**
 * Handler for link reference nodes (reference-style links: [text][ref])
 */
class LinkReferenceHandler extends BaseNodeHandler {
  canHandle(node: Node): boolean {
    return node.type === "linkReference";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const linkRefNode = node as LinkReference;
    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    const decorations: DecorationRange[] = [];

    // Find the brackets in the source text
    // Format: [text][ref] or [text][]
    // The AST node position should include the entire reference link syntax
    const linkText = text.substring(startOffset, endOffset);

    // Check if this starts with a bracket (should be for reference links)
    if (linkText[0] !== "[") {
      return [];
    }

    const bracketStart = startOffset;

    // Find closing bracket ] for text
    let bracketEnd = bracketStart + 1;
    while (bracketEnd < endOffset && text[bracketEnd] !== "]") {
      bracketEnd++;
    }

    if (bracketEnd >= endOffset) {
      // No closing bracket found
      return [];
    }

    // Find opening bracket [ for reference - should be right after closing bracket or with whitespace
    let refBracketStart = bracketEnd + 1;
    while (refBracketStart < endOffset && text[refBracketStart] !== "[") {
      if (
        text[refBracketStart] !== " " &&
        text[refBracketStart] !== "\n" &&
        text[refBracketStart] !== "\r"
      ) {
        // No second bracket found
        return [];
      }
      refBracketStart++;
    }

    if (refBracketStart >= endOffset) {
      // No reference bracket found
      return [];
    }

    // Find closing bracket ] for reference
    let refBracketEnd = refBracketStart + 1;
    while (refBracketEnd < endOffset && text[refBracketEnd] !== "]") {
      refBracketEnd++;
    }

    if (refBracketEnd >= endOffset) {
      // No closing reference bracket found
      return [];
    }

    if (bracketStart < bracketEnd && refBracketStart < refBracketEnd) {
      // Hide opening bracket for text
      decorations.push({
        type: "hide",
        startPos: bracketStart,
        endPos: bracketStart + 1,
      });

      // Hide closing bracket for text
      decorations.push({
        type: "hide",
        startPos: bracketEnd,
        endPos: bracketEnd + 1,
      });

      // Hide reference brackets [ref]
      decorations.push({
        type: "hide",
        startPos: refBracketStart,
        endPos: refBracketEnd + 1,
      });

      // Apply link decoration to the text content (between first brackets)
      const textStart = bracketStart + 1;
      const textEnd = bracketEnd;
      if (textEnd > textStart) {
        decorations.push({
          type: "link",
          startPos: textStart,
          endPos: textEnd,
        });
      }
    }

    return decorations;
  }
}

/**
 * Handler for image reference nodes (reference-style images: ![alt][ref])
 */
class ImageReferenceHandler extends BaseNodeHandler {
  canHandle(node: Node): boolean {
    return node.type === "imageReference";
  }

  extractDecorations(node: Node, text: string): DecorationRange[] {
    if (!this.hasValidPosition(node)) {
      return [];
    }

    const imageRefNode = node as ImageReference;
    const startOffset = node.position.start.offset!;
    const endOffset = node.position.end.offset!;

    const decorations: DecorationRange[] = [];

    // Find the !, brackets in the source text
    // Format: ![alt][ref]
    // The AST node position should include the entire reference image syntax
    const imageText = text.substring(startOffset, endOffset);

    // Check if this starts with exclamation mark (should be for images)
    if (imageText[0] !== "!") {
      return [];
    }

    const exclamationStart = startOffset;
    const bracketStart = startOffset + 1;

    // Check if bracket is at expected position
    if (bracketStart >= endOffset || text[bracketStart] !== "[") {
      return [];
    }

    // Find closing bracket ] for alt
    let bracketEnd = bracketStart + 1;
    while (bracketEnd < endOffset && text[bracketEnd] !== "]") {
      bracketEnd++;
    }

    if (bracketEnd >= endOffset) {
      // No closing bracket found
      return [];
    }

    // Find opening bracket [ for reference - should be right after closing bracket or with whitespace
    let refBracketStart = bracketEnd + 1;
    while (refBracketStart < endOffset && text[refBracketStart] !== "[") {
      if (
        text[refBracketStart] !== " " &&
        text[refBracketStart] !== "\n" &&
        text[refBracketStart] !== "\r"
      ) {
        // No second bracket found
        return [];
      }
      refBracketStart++;
    }

    if (refBracketStart >= endOffset) {
      // No reference bracket found
      return [];
    }

    // Find closing bracket ] for reference
    let refBracketEnd = refBracketStart + 1;
    while (refBracketEnd < endOffset && text[refBracketEnd] !== "]") {
      refBracketEnd++;
    }

    if (refBracketEnd >= endOffset) {
      // No closing reference bracket found
      return [];
    }

    if (
      exclamationStart < bracketStart &&
      bracketStart < bracketEnd &&
      refBracketStart < refBracketEnd
    ) {
      // Hide exclamation mark
      decorations.push({
        type: "hide",
        startPos: exclamationStart,
        endPos: exclamationStart + 1,
      });

      // Hide opening bracket for alt
      decorations.push({
        type: "hide",
        startPos: bracketStart,
        endPos: bracketStart + 1,
      });

      // Hide closing bracket for alt
      decorations.push({
        type: "hide",
        startPos: bracketEnd,
        endPos: bracketEnd + 1,
      });

      // Hide reference brackets [ref]
      decorations.push({
        type: "hide",
        startPos: refBracketStart,
        endPos: refBracketEnd + 1,
      });

      // Apply image decoration to the alt text (between first brackets)
      const altStart = bracketStart + 1;
      const altEnd = bracketEnd;
      if (altEnd > altStart) {
        decorations.push({
          type: "image",
          startPos: altStart,
          endPos: altEnd,
        });
      }
    }

    return decorations;
  }
}

/**
 * Handler for highlighted text (==text==)
 * Note: This is not standard markdown, so we parse it manually
 */
class HighlightHandler {
  /**
   * Extract highlight decorations by manually parsing the text
   * This is called separately from AST processing
   */
  extractDecorations(text: string): DecorationRange[] {
    const decorations: DecorationRange[] = [];
    let pos = 0;

    while (pos < text.length) {
      // Find opening ==
      const openIndex = text.indexOf("==", pos);
      if (openIndex === -1) {
        break;
      }

      // Find closing == after the opening
      const closeIndex = text.indexOf("==", openIndex + 2);
      if (closeIndex === -1) {
        break;
      }

      // Check that there's content between the delimiters
      const contentStart = openIndex + 2;
      const contentEnd = closeIndex;

      if (contentEnd > contentStart) {
        // Hide delimiters
        decorations.push({
          type: "hide",
          startPos: openIndex,
          endPos: openIndex + 2,
        });
        decorations.push({
          type: "hide",
          startPos: closeIndex,
          endPos: closeIndex + 2,
        });
        // Apply highlight decoration with yellow background
        decorations.push({
          type: "highlight",
          startPos: contentStart,
          endPos: contentEnd,
        });
      }

      pos = closeIndex + 2;
    }

    return decorations;
  }
}

/**
 * Manages collection and deduplication of decoration ranges
 */
class DecorationCollector {
  private ranges: DecorationRange[] = [];
  private readonly seen = new Set<string>();

  /**
   * Add a decoration range if it's not already present
   */
  add(decoration: DecorationRange): void {
    const key = this.createKey(decoration);
    if (!this.seen.has(key)) {
      this.seen.add(key);
      this.ranges.push(decoration);
    }
  }

  /**
   * Add multiple decoration ranges
   */
  addAll(decorations: DecorationRange[]): void {
    decorations.forEach((decoration) => this.add(decoration));
  }

  /**
   * Get all collected decorations (deduplicated)
   */
  getAll(): DecorationRange[] {
    return [...this.ranges];
  }

  /**
   * Clear all collected decorations
   */
  clear(): void {
    this.ranges = [];
    this.seen.clear();
  }

  private createKey(decoration: DecorationRange): string {
    return `${decoration.startPos}-${decoration.endPos}-${decoration.type}`;
  }
}

/**
 * Main parser class that orchestrates AST parsing and decoration extraction
 * Follows Single Responsibility Principle - only responsible for parsing coordination
 */
export class MarkdownParser {
  private readonly processor = unified().use(remarkParse).use(remarkGfm);
  private readonly handlers: NodeHandler[];
  private readonly highlightHandler = new HighlightHandler();

  constructor() {
    // Register all node handlers (OCP - easy to add new handlers)
    // Order matters: StrongHandler should come before EmphasisHandler
    // so bold-italic cases are handled correctly
    this.handlers = [
      new HeadingHandler(),
      new StrongHandler(),
      new EmphasisHandler(),
      new InlineCodeHandler(),
      new CodeBlockHandler(),
      new BlockquoteHandler(),
      new HorizontalRuleHandler(),
      new DeleteHandler(),
      new LinkHandler(),
      new ImageHandler(),
      new LinkReferenceHandler(),
      new ImageReferenceHandler(),
    ];
  }

  /**
   * Parse markdown and extract all decoration ranges
   */
  extractDecorations(text: string): DecorationRange[] {
    const ast = this.parseAST(text);
    const collector = new DecorationCollector();
    // Track emphasis nodes that are part of bold-italic to avoid double processing
    const boldItalicEmphasisRanges = new Set<string>();

    // Process AST nodes
    visit(ast, (node: Node) => {
      const handler = this.findHandler(node);
      if (handler) {
        const decorations = handler.extractDecorations(node, text);

        // If this is a strong node with emphasis children, track the emphasis content ranges
        // (excluding delimiters, since EmphasisHandler will create decorations for content only)
        if (node.type === "strong" && (node as Strong).children) {
          const strongNode = node as Strong;
          const hasEmphasis = strongNode.children.some(
            (child) => child.type === "emphasis"
          );
          if (hasEmphasis && this.hasValidPosition(node)) {
            // Track all emphasis children content ranges (excluding delimiters)
            strongNode.children.forEach((child) => {
              if (child.type === "emphasis" && this.hasValidPosition(child)) {
                const emphasisStart = child.position.start.offset!;
                const emphasisEnd = child.position.end.offset!;
                // Calculate content range (excluding single delimiter on each side)
                const contentStart = emphasisStart + 1;
                const contentEnd = emphasisEnd - 1;
                if (contentEnd > contentStart) {
                  const key = `${contentStart}-${contentEnd}`;
                  boldItalicEmphasisRanges.add(key);
                }
              }
            });
          }
        }

        collector.addAll(decorations);
      }
    });

    // Filter out emphasis decorations that are part of bold-italic
    // (They're already handled by StrongHandler)
    const allDecorations = collector.getAll();
    const filteredDecorations = allDecorations.filter((dec) => {
      if (dec.type === "italic") {
        const key = `${dec.startPos}-${dec.endPos}`;
        // Check if this range overlaps with a bold-italic emphasis range
        for (const rangeKey of boldItalicEmphasisRanges) {
          const parts = rangeKey.split("-");
          if (parts.length === 2) {
            const start = Number(parts[0]);
            const end = Number(parts[1]);
            if (!isNaN(start) && !isNaN(end)) {
              // If the italic decoration overlaps significantly with a bold-italic emphasis range, skip it
              if (
                (dec.startPos >= start && dec.startPos < end) ||
                (dec.endPos > start && dec.endPos <= end) ||
                (dec.startPos <= start && dec.endPos >= end)
              ) {
                return false;
              }
            }
          }
        }
      }
      return true;
    });

    // Process manual parsers for non-standard features (highlight)
    const highlightDecorations = this.highlightHandler.extractDecorations(text);
    filteredDecorations.push(...highlightDecorations);

    return filteredDecorations;
  }

  private hasValidPosition(node: Node): node is Node & PositionedNode {
    return (
      !!node.position &&
      node.position.start.offset !== undefined &&
      node.position.start.offset !== null &&
      node.position.end.offset !== undefined &&
      node.position.end.offset !== null
    );
  }

  /**
   * Parse text into AST
   */
  private parseAST(text: string): Root {
    return this.processor.parse(text) as Root;
  }

  /**
   * Find the appropriate handler for a node (Strategy pattern)
   */
  private findHandler(node: Node): NodeHandler | undefined {
    return this.handlers.find((handler) => handler.canHandle(node));
  }
}
