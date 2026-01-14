import type { Root, Node, Strong, Emphasis, Heading, InlineCode, Code, Link, Image, Delete, Blockquote, ListItem, ThematicBreak, Html } from 'mdast';
import { getRemarkProcessorSync, getRemarkProcessor } from './parser-remark';

/**
 * Represents a decoration range in the markdown document.
 * 
 * @interface DecorationRange
 * @property {number} startPos - Character position (0-based, inclusive)
 * @property {number} endPos - Character position (0-based, exclusive)
 * @property {DecorationType} type - The type of decoration to apply
 */
export interface DecorationRange {
  startPos: number;
  endPos: number;
  type: DecorationType;
  url?: string; // URL for link decorations (for clickable links)
  level?: number; // Nesting level for blockquotes
}

/**
 * Types of decorations that can be applied to markdown content.
 */
export type DecorationType =
  | 'hide'
  | 'transparent'
  | 'bold'
  | 'italic'
  | 'boldItalic'
  | 'strikethrough'
  | 'code'
  | 'codeBlock'
  | 'heading'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'link'
  | 'image'
  | 'blockquote'
  | 'listItem'
  | 'orderedListItem'
  | 'checkboxUnchecked'
  | 'checkboxChecked'
  | 'horizontalRule'
  | 'frontmatter'
  | 'htmlTag';

/**
 * Type for the unified processor used to parse markdown text to a Root AST node.
 * 
 * The processor is created by the `unified()` function from the unified ecosystem
 * and configured with remark-parse and remark-gfm plugins.
 */
type UnifiedProcessor = {
  parse: (text: string) => Root;
};

/**
 * Type for the visit function from unist-util-visit.
 * 
 * Traverses nodes in a tree structure (AST) and calls the visitor function
 * for each node. The visitor receives: node, index (optional), parent (optional).
 */
type VisitFunction = (
  tree: Root,
  visitor: (node: Node, index?: number, parent?: Node) => void
) => void;

/**
 * A parser that extracts decoration ranges from markdown text.
 *
 * This class uses `remark` to parse the input markdown and determines ranges for:
 * - Markdown syntax markers (for hiding, e.g., `**`, `#`, `` ` ``)
 * - Content (for applying styles such as bold, italic, headings, etc.)
 *
 * @class MarkdownParser
 * @example
 * // Synchronous usage (VS Code extension):
 * const parser = new MarkdownParser();
 * const decorations = parser.extractDecorations('# Heading\n**bold** text');
 *
 * // Asynchronous usage (ESM tests):
 * const parser = await MarkdownParser.create();
 * const decorations = parser.extractDecorations('# Heading\n**bold** text');
 */
export class MarkdownParser {
  private processor: UnifiedProcessor;
  private visit: VisitFunction;

  constructor() {
    const { unified, remarkParse, remarkGfm, visit } = getRemarkProcessorSync();
    this.visit = visit;
    this.processor = unified()
      .use(remarkParse)
      .use(remarkGfm);
  }

  /**
   * Async factory method to create a MarkdownParser instance.
   * Uses dynamic imports to support ESM modules in test environments.
   * 
   * @returns {Promise<MarkdownParser>} A promise that resolves to a MarkdownParser instance
   */
  static async create(): Promise<MarkdownParser> {
    const parser = Object.create(MarkdownParser.prototype);
    const { unified, remarkParse, remarkGfm, visit } = await getRemarkProcessor();
    parser.visit = visit;
    parser.processor = unified()
      .use(remarkParse)
      .use(remarkGfm);
    return parser;
  }

  /**
   * Extracts decoration ranges from markdown text.
   * 
   * @param {string} text - The markdown text to parse
   * @returns {DecorationRange[]} Array of decoration ranges, sorted by startPos
   */
  extractDecorations(text: string): DecorationRange[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Normalize line endings to \n for consistent position tracking
    // Optimization: Only normalize if document contains CRLF
    const normalizedText = text.indexOf('\r') !== -1 
      ? text.replace(/\r\n|\r/g, '\n')
      : text;
    
    const decorations: DecorationRange[] = [];
    
    // Process frontmatter before remark parsing to avoid conflicts with thematic break detection
    this.processFrontmatter(normalizedText, decorations);
    
    try {
      // Parse markdown into AST
      const ast = this.processor.parse(normalizedText) as Root;
      
      // Process AST nodes and extract decorations
      this.processAST(ast, normalizedText, decorations);
      
      // Handle edge cases: empty image alt text that remark doesn't parse as Image node
      this.handleEmptyImageAlt(normalizedText, decorations);
      
      // Sort decorations by start position
      decorations.sort((a, b) => a.startPos - b.startPos);
    } catch (error) {
      // Gracefully handle parse errors
      console.error('Error parsing markdown:', error);
    }

    return decorations;
  }

  /**
   * Processes the remark AST to extract decoration ranges.
   * 
   * Uses a proper visitor pattern with ancestor tracking for efficient traversal.
   * 
   * @private
   * @param {Root} ast - The parsed AST root node
   * @param {string} text - The original markdown text
   * @param {DecorationRange[]} decorations - Array to accumulate decorations
   */
  private processAST(
    ast: Root,
    text: string,
    decorations: DecorationRange[]
  ): void {
    // Track processed blockquote positions to avoid duplicates from nested blockquotes
    const processedBlockquotePositions = new Set<number>();
    
    // Use a map to efficiently track ancestors for each node
    const ancestorMap = new Map<Node, Node[]>();

    this.visit(ast, (node: Node, index: number | undefined, parent: Node | undefined) => {
      // Optimization: Trust remark's position data in hot path
      // Individual process methods still validate for safety
      try {
        // Build ancestor chain efficiently using parent's cached ancestors
        const currentAncestors: Node[] = [];
        if (parent) {
          currentAncestors.push(parent);
          // Get parent's ancestors from cache (O(1) lookup instead of O(n) search)
          const parentAncestors = ancestorMap.get(parent);
          if (parentAncestors) {
            currentAncestors.push(...parentAncestors);
          }
        }
        
        // Cache this node's ancestors for its children to use
        if (currentAncestors.length > 0) {
          ancestorMap.set(node, currentAncestors);
        }

        switch (node.type) {
          case 'heading':
            this.processHeading(node as Heading, text, decorations);
            break;

          case 'strong':
            this.processStrong(node as Strong, text, decorations, currentAncestors);
            break;

          case 'emphasis':
            this.processEmphasis(node as Emphasis, text, decorations, currentAncestors);
            break;

          case 'delete':
            this.processStrikethrough(node as Delete, text, decorations);
            break;

          case 'inlineCode':
            this.processInlineCode(node as InlineCode, text, decorations);
            break;

          case 'code':
            this.processCodeBlock(node as Code, text, decorations);
            break;

          case 'link':
            this.processLink(node as Link, text, decorations);
            break;

          case 'image':
            this.processImage(node as Image, text, decorations);
            break;

          case 'blockquote':
            this.processBlockquote(node as Blockquote, text, decorations, processedBlockquotePositions);
            break;

          case 'listItem':
            this.processListItem(node as ListItem, text, decorations);
            break;

          case 'thematicBreak':
            this.processThematicBreak(node as ThematicBreak, text, decorations);
            break;
          
          case 'html':
            this.processHtml(node as Html, text, decorations);
            break;
        }
      } catch (error) {
        // Gracefully handle invalid positions or processing errors
        // Individual methods still validate, so this catches unexpected issues
        console.warn('Error processing AST node:', node.type, error);
      }
    });
  }

  /**
   * Validates that a node has valid position information.
   * @returns {boolean} True if node position is valid
   */
  private hasValidPosition(node: Node): boolean {
    return !!(node.position && 
              node.position.start.offset !== undefined && 
              node.position.end.offset !== undefined);
  }

  /**
   * Adds hide decorations for opening and closing markers, and content decoration.
   * Common pattern for bold, italic, strikethrough, and inline code.
   * 
   * @param decorations - Array to add decorations to
   * @param start - Start position of the node
   * @param end - End position of the node
   * @param markerLength - Length of the opening/closing marker
   * @param contentType - Type of decoration for the content
   */
  private addMarkerDecorations(
    decorations: DecorationRange[],
    start: number,
    end: number,
    markerLength: number,
    contentType: DecorationType
  ): void {
    const contentStart = start + markerLength;
    const contentEnd = end - markerLength;

    // Hide opening marker
    decorations.push({ startPos: start, endPos: contentStart, type: 'hide' });

    // Add content decoration
    if (contentStart < contentEnd) {
      decorations.push({ startPos: contentStart, endPos: contentEnd, type: contentType });
    }

    // Hide closing marker
    decorations.push({ startPos: contentEnd, endPos: end, type: 'hide' });
  }

  /**
   * Processes a heading node.
   */
  private processHeading(
    node: Heading,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Find the heading marker (#) by checking the source text
    let markerLength = 0;
    let pos = start;
    while (pos < end && text[pos] === '#') {
      markerLength++;
      pos++;
    }

    if (markerLength === 0) return;

    const level = markerLength;
    const headingType = `heading${level}` as DecorationType;

    // Find whitespace after marker
    const contentStart = start + markerLength;
    let whitespaceLength = 0;
    let posAfterMarker = contentStart;
    while (posAfterMarker < end && /\s/.test(text[posAfterMarker])) {
      whitespaceLength++;
      posAfterMarker++;
    }

    const hideEnd = contentStart + whitespaceLength;

    // Hide the marker AND the whitespace after it
    decorations.push({
      startPos: start,
      endPos: hideEnd,
      type: 'hide',
    });

    // Find content end (exclude trailing whitespace)
    let contentEnd = end;
    while (contentEnd > hideEnd && /\s/.test(text[contentEnd - 1])) {
      contentEnd--;
    }

    // Style the heading content (from after marker+whitespace to end of line)
    if (hideEnd < contentEnd) {
      // Add specific heading decoration
      decorations.push({
        startPos: hideEnd,
        endPos: contentEnd,
        type: headingType,
      });

      // Also add generic heading decoration
      decorations.push({
        startPos: hideEnd,
        endPos: contentEnd,
        type: 'heading',
      });
    }
  }

  /**
   * Processes a strong (bold) node.
   */
  private processStrong(
    node: Strong,
    text: string,
    decorations: DecorationRange[],
    ancestors: Node[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Determine marker type by checking source text (** or __)
    const marker = this.getBoldMarker(text, start);
    if (!marker) return;

    const markerLength = marker.length;

    // Check if this is bold+italic (nested with emphasis)
    const isBoldItalic = ancestors.some(a => a.type === 'emphasis');
    const contentType: DecorationType = isBoldItalic ? 'boldItalic' : 'bold';

    this.addMarkerDecorations(decorations, start, end, markerLength, contentType);

    // Process children for nested decorations (handled by visit)
  }

  /**
   * Processes an emphasis (italic) node.
   */
  /**
   * Processes an emphasis (italic) node.
   */
  private processEmphasis(
    node: Emphasis,
    text: string,
    decorations: DecorationRange[],
    ancestors: Node[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Determine marker type by checking source text
    const marker = this.getItalicMarker(text, start);
    if (!marker) return;

    const markerLength = marker.length;

    // Skip if this emphasis is part of ***text*** pattern
    // In that case, strong node already handles the decoration
    const parentStrong = ancestors.find(a => a.type === 'strong');
    if (parentStrong && parentStrong.position) {
      const strongStart = parentStrong.position.start.offset ?? -1;
      const strongEnd = parentStrong.position.end.offset ?? -1;
      
      // Check if emphasis markers overlap with strong markers (***text*** case)
      if (start === strongStart + 2 && end === strongEnd - 2) {
        return; // Strong node already applied boldItalic decoration
      }
    }

    // Check if this is bold+italic (nested with strong)
    const isBoldItalic = ancestors.some(a => a.type === 'strong');
    const contentType: DecorationType = isBoldItalic ? 'boldItalic' : 'italic';

    this.addMarkerDecorations(decorations, start, end, markerLength, contentType);
  }

  /**
   * Processes a strikethrough (delete) node.
   */
  private processStrikethrough(
    node: Delete,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Strikethrough uses ~~ markers (length 2)
    this.addMarkerDecorations(decorations, start, end, 2, 'strikethrough');
  }

  /**
   * Processes an inline code node.
   * 
   * Matches Markless approach: applies code decoration (with border) to the entire range
   * including backticks, then hides the backticks separately. This ensures the border
   * spans the full code block and works correctly even on single lines.
   */
  private processInlineCode(
    node: InlineCode,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Count backticks at start to determine marker length
    let markerLength = 0;
    let pos = start;
    while (pos < end && text[pos] === '`') {
      markerLength++;
      pos++;
    }

    if (markerLength === 0) return;

    // Apply code decoration to ENTIRE range (including backticks)
    // This ensures the border spans the full code block
    decorations.push({ startPos: start, endPos: end, type: 'code' });

    // Make backticks transparent (not hidden) - matches Markless approach
    // Using 'transparent' instead of 'hide' keeps backticks in layout,
    // which is required for borders to render correctly on single lines
    decorations.push({ startPos: start, endPos: start + markerLength, type: 'transparent' });
    decorations.push({ startPos: end - markerLength, endPos: end, type: 'transparent' });
  }

  /**
   * Processes a code block node.
   */
  private processCodeBlock(
    node: Code,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!

    // Find opening fence (```)
    const fenceStart = text.indexOf('```', start);
    if (fenceStart === -1) return;

    // Find closing fence
    const closingFence = text.lastIndexOf('```', end);
    if (closingFence === -1 || closingFence <= fenceStart) return;

    // Find the end of the opening fence line (including language identifier and newline)
    const openingLineEnd = text.indexOf('\n', fenceStart);
    const openingEnd = openingLineEnd !== -1 && openingLineEnd < closingFence ? openingLineEnd + 1 : fenceStart + 3;

    // Find the end of the closing fence (just after ```)
    const closingFenceEnd = closingFence + 3;
    
    // Find if there's a newline after the closing fence
    const closingLineEnd = text.indexOf('\n', closingFence);
    const closingEnd = closingLineEnd !== -1 ? closingLineEnd + 1 : end;

    // Apply code block background to the entire block including fence lines
    // but NOT including the newline after the closing fence
    decorations.push({
      startPos: fenceStart,
      endPos: closingFenceEnd,
      type: 'codeBlock',
    });

    // Hide the opening fence line (```, language identifier, and newline)
    decorations.push({
      startPos: fenceStart,
      endPos: openingEnd,
      type: 'hide',
    });

    // Hide the closing fence line (```, and newline if present)
    decorations.push({
      startPos: closingFence,
      endPos: closingEnd,
      type: 'hide',
    });
  }

  /**
   * Processes a link node.
   */
  private processLink(
    node: Link,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Find opening bracket [
    const bracketStart = text.indexOf('[', start);
    if (bracketStart === -1) return;

    // Find closing bracket ]
    const bracketEnd = text.indexOf(']', bracketStart);
    if (bracketEnd === -1) return;

    // Hide opening bracket
    decorations.push({
      startPos: bracketStart,
      endPos: bracketStart + 1,
      type: 'hide',
    });

    // Add link decoration for text (between brackets)
    const contentStart = bracketStart + 1;
    if (contentStart < bracketEnd) {
      // Extract URL from the link node
      const url = node.url || '';
      
      decorations.push({
        startPos: contentStart,
        endPos: bracketEnd,
        type: 'link',
        url: url,
      });
    }

    // Hide closing bracket
    decorations.push({
      startPos: bracketEnd,
      endPos: bracketEnd + 1,
      type: 'hide',
    });

    // Find and hide URL part (url)
    const parenStart = text.indexOf('(', bracketEnd);
    if (parenStart !== -1 && parenStart === bracketEnd + 1) {
      // Hide opening parenthesis
      decorations.push({
        startPos: parenStart,
        endPos: parenStart + 1,
        type: 'hide',
      });

      const parenEnd = text.indexOf(')', parenStart + 1);
      if (parenEnd !== -1 && parenEnd <= end) {
        // Hide URL content between parentheses
        const urlStart = parenStart + 1;
        if (urlStart < parenEnd) {
          decorations.push({
            startPos: urlStart,
            endPos: parenEnd,
            type: 'hide',
          });
        }

        // Hide closing parenthesis
        decorations.push({
          startPos: parenEnd,
          endPos: parenEnd + 1,
          type: 'hide',
        });
      }
    }
  }

  /**
   * Processes an image node.
   */
  private processImage(
    node: Image,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Find opening ![
    const exclamationStart = text.indexOf('![', start);
    if (exclamationStart === -1 || exclamationStart > start) return;

    // Hide ![
    decorations.push({
      startPos: exclamationStart,
      endPos: exclamationStart + 2,
      type: 'hide',
    });

    // Find alt text (between [ and ])
    const altStart = exclamationStart + 2;
    const bracketEnd = text.indexOf(']', altStart);
    if (bracketEnd === -1) {
      // Even if no closing bracket found, try to hide what we can
      // This handles edge cases like ![] without proper syntax
      return;
    }

    // Add image decoration for alt text (even if empty)
    if (altStart <= bracketEnd) {
      decorations.push({
        startPos: altStart,
        endPos: bracketEnd,
        type: 'image',
      });
    }

    // Hide closing bracket
    decorations.push({
      startPos: bracketEnd,
      endPos: bracketEnd + 1,
      type: 'hide',
    });

    // Find and hide URL part
    const parenStart = text.indexOf('(', bracketEnd);
    if (parenStart !== -1) {
      // Allow for optional space between ] and (
      if (parenStart === bracketEnd + 1 || (parenStart > bracketEnd + 1 && text.substring(bracketEnd + 1, parenStart).trim().length === 0)) {
        decorations.push({
          startPos: parenStart,
          endPos: parenStart + 1,
          type: 'hide',
        });

        const parenEnd = text.indexOf(')', parenStart + 1);
        if (parenEnd !== -1 && parenEnd < end) {
          decorations.push({
            startPos: parenEnd,
            endPos: parenEnd + 1,
            type: 'hide',
          });
        }
      }
    }
  }

  /**
   * Processes a blockquote node.
   * 
   * Replaces '>' characters with vertical bars for visual indication.
   * Nested blockquotes automatically show multiple bars (one per '>').
   * 
   * @param processedPositions - Set to track which positions have already been processed
   */
  private processBlockquote(
    node: Blockquote,
    text: string,
    decorations: DecorationRange[],
    processedPositions: Set<number>
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Find all '>' markers at the start of lines within this blockquote
    // Blockquotes can span multiple lines, each starting with '>'
    let pos = start;
    while (pos < end) {
      // Find line start (either document start or after newline)
      const lineStart = pos === 0 ? 0 : text.lastIndexOf('\n', pos - 1) + 1;
      
      // Find all '>' markers on this line (for nested blockquotes like "> > >")
      // We process all '>' markers that are at the start of the line or after whitespace/other '>'
      let searchStart = lineStart;
      const lineEnd = text.indexOf('\n', lineStart);
      const actualLineEnd = lineEnd === -1 ? end : Math.min(lineEnd, end);
      
      while (searchStart < actualLineEnd) {
        const gtIndex = text.indexOf('>', searchStart);
        if (gtIndex === -1 || gtIndex >= actualLineEnd) break;
        
        // Check if we've already processed this position (from a parent blockquote node)
        if (processedPositions.has(gtIndex)) {
          searchStart = gtIndex + 1;
          continue;
        }
        
        // Check if there's only whitespace and/or '>' before this '>'
        // This allows nested blockquotes like "> > >" where each '>' is valid
        const beforeGt = text.substring(lineStart, gtIndex);
        const isBlockquoteMarker = beforeGt.trim().length === 0 || /^[\s>]*$/.test(beforeGt);
        
        if (isBlockquoteMarker) {
          // Mark this position as processed
          processedPositions.add(gtIndex);
          
          // Replace only the '>' character with blockquote decoration (vertical bar)
          // Keep the space after it visible to maintain proper spacing
          decorations.push({
            startPos: gtIndex,
            endPos: gtIndex + 1,
            type: 'blockquote',
          });
          searchStart = gtIndex + 1;
        } else {
          // Not a blockquote marker, move past it
          searchStart = gtIndex + 1;
        }
      }
      
      // Move to next line
      const nextLine = text.indexOf('\n', pos);
      if (nextLine === -1 || nextLine >= end) break;
      pos = nextLine + 1;
    }
  }

  /**
   * Processes a list item node.
   *
   * Replaces unordered list markers (-, *, +) with a bullet point (•).
   * Keeps ordered list markers (1., 2., etc.) as-is (no decoration).
   * Detects and decorates checkboxes ([ ] or [x]) after the marker.
   * Supports both unordered lists (-, *, +) and ordered lists (1., 2., etc.).
   */
  private processListItem(
    node: ListItem,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Find the list marker at the start of the list item
    let markerEnd = start;
    
    // Skip leading whitespace
    while (markerEnd < end && /\s/.test(text[markerEnd])) {
      markerEnd++;
    }
    
    if (markerEnd >= end) return;
    
    const markerStart = markerEnd;
    
    // Check for unordered list markers: -, *, +
    if (text[markerEnd] === '-' || text[markerEnd] === '*' || text[markerEnd] === '+') {
      markerEnd++;
      // Skip optional space after marker
      if (markerEnd < end && text[markerEnd] === ' ') {
        markerEnd++;
      }
      
      // Try to detect and add checkbox, otherwise add regular list item decoration
      if (this.tryAddCheckboxDecorations(text, markerStart, markerEnd, end, decorations, false)) {
        return;
      }
      
      decorations.push({
        startPos: markerStart,
        endPos: markerEnd,
        type: 'listItem',
      });
      return;
    }
    
    // Check for ordered list markers: 1., 2., etc. or 1), 2), etc.
    if (/\d/.test(text[markerEnd])) {
      // Find the end of the number
      let numEnd = markerEnd;
      while (numEnd < end && /\d/.test(text[numEnd])) {
        numEnd++;
      }
      
      // Check if followed by '.' or ')'
      if (numEnd < end && (text[numEnd] === '.' || text[numEnd] === ')')) {
        markerEnd = numEnd + 1;
        // Skip optional space after marker
        if (markerEnd < end && text[markerEnd] === ' ') {
          markerEnd++;
        }
        
        // For ordered lists: only add checkbox decoration if present, otherwise apply color styling
        // Ordered lists should NOT be decorated with listItem (bullet point)
        if (this.tryAddCheckboxDecorations(text, markerStart, markerEnd, end, decorations, true)) {
          return;
        }
        
        // Apply color decoration to ordered list markers to ensure they match regular text color
        decorations.push({
          startPos: markerStart,
          endPos: markerEnd,
          type: 'orderedListItem',
        });
        return;
      }
    }
  }

  /**
   * Attempts to detect and add checkbox decorations after a list marker.
   * 
   * @param text - The full document text
   * @param markerStart - Start position of the list marker
   * @param markerEnd - End position after the marker (and optional space)
   * @param end - End position of the list item
   * @param decorations - Array to add decorations to
   * @param isOrderedList - Whether this is an ordered list (true) or unordered list (false)
   * @returns true if checkbox was found and decorations were added, false otherwise
   */
  private tryAddCheckboxDecorations(
    text: string,
    markerStart: number,
    markerEnd: number,
    end: number,
    decorations: DecorationRange[],
    isOrderedList: boolean
  ): boolean {
    // Check for checkbox pattern: [ ] or [x] or [X]
    // GFM requires a space after the closing bracket for task lists
    if (markerEnd + 3 >= end || text[markerEnd] !== '[') {
      return false;
    }
    
    const checkChar = text[markerEnd + 1];
    if ((checkChar !== ' ' && checkChar !== 'x' && checkChar !== 'X') || text[markerEnd + 2] !== ']') {
      return false;
    }
    
    // GFM spec requires a space after the closing bracket for task lists
    // Without a space, it's not a valid task list (e.g., "- [x]task" is not a task list)
    if (text[markerEnd + 3] !== ' ') {
      return false;
    }
    
    // Found a valid checkbox - add decorations
    const checkboxStart = markerEnd;
    const checkboxEnd = checkboxStart + 3; // [ ], [x], or [X] (space after is not part of checkbox)
    const isChecked = checkChar === 'x' || checkChar === 'X';
    
    // Only apply listItem decoration (bullet point) for unordered lists
    // Ordered lists should keep their numbers visible
    if (!isOrderedList) {
      decorations.push({
        startPos: markerStart,
        endPos: checkboxStart,
        type: 'listItem',
      });
    } else {
      // For ordered lists with checkboxes, apply color decoration to the numbers
      decorations.push({
        startPos: markerStart,
        endPos: markerEnd,
        type: 'orderedListItem',
      });
    }
    
    decorations.push({
      startPos: checkboxStart,
      endPos: checkboxEnd,
      type: isChecked ? 'checkboxChecked' : 'checkboxUnchecked',
    });
    
    return true;
  }

  /**
   * Processes a thematic break (horizontal rule) node.
   * 
   * Replaces the text (---, ***, ___) with a visual horizontal line.
   * Skips thematic breaks that are part of a frontmatter block.
   */
  private processThematicBreak(
    node: ThematicBreak,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Skip if this thematic break is within a frontmatter block
    // Frontmatter delimiters should not be processed as horizontal rules
    const isInFrontmatter = decorations.some(d => 
      d.type === 'frontmatter' && 
      d.startPos <= start && 
      d.endPos >= end
    );
    
    if (isInFrontmatter) {
      return; // Skip processing this thematic break - it's part of frontmatter
    }

    // Replace the entire horizontal rule text with a decoration
    decorations.push({
      startPos: start,
      endPos: end,
      type: 'horizontalRule',
    });
  }

  /**
   * Processes an HTML node to detect and decorate tags within it.
   * 
   * This styles tag markers only and leaves content untouched.
   */
  private processHtml(
    node: Html,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    if (start >= end) return;

    const htmlSource = text.slice(start, end);
    if (htmlSource.indexOf('<') === -1) {
      return;
    }

    // Lightweight tag matcher for opening, closing, and self-closing tags.
    // Keeps it simple to avoid full HTML parsing.
    const tagRegex = /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s[^<>]*?)?\/?>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(htmlSource)) !== null) {
      const tagStart = start + match.index;
      const tagEnd = tagStart + match[0].length;

      if (tagStart >= start && tagEnd <= end) {
        decorations.push({
          startPos: tagStart,
          endPos: tagEnd,
          type: 'htmlTag',
        });
      }
    }
  }

  /**
   * Handles empty image alt text that remark doesn't parse as an Image node.
   * Optimized with early exit to avoid regex when no image syntax exists.
   */
  private handleEmptyImageAlt(text: string, decorations: DecorationRange[]): void {
    // Early exit: check if '![' exists in text before running regex
    if (text.indexOf('![') === -1) {
      return;
    }
    
    // Find ![] patterns that weren't handled by processImage
    const regex = /!\[\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const pos = match.index;
      // Check if this position is already covered by a decoration
      const isCovered = decorations.some(d => d.startPos <= pos && d.endPos > pos);
      if (!isCovered) {
        // Add hide decorations for ![
        decorations.push({
          startPos: pos,
          endPos: pos + 2,
          type: 'hide',
        });
        // Add hide decoration for ]
        decorations.push({
          startPos: pos + 2,
          endPos: pos + 3,
          type: 'hide',
        });
      }
    }
  }

  /**
   * Gets the bold marker type (** or __) from source text.
   * Optimized to use character code comparisons instead of substring allocation.
   */
  private getBoldMarker(text: string, pos: number): string | null {
    if (pos + 2 <= text.length) {
      const char1 = text.charCodeAt(pos);
      const char2 = text.charCodeAt(pos + 1);
      
      // Check for '**' (asterisk = 0x2A)
      if (char1 === 0x2A && char2 === 0x2A) {
        return '**';
      }
      
      // Check for '__' (underscore = 0x5F)
      if (char1 === 0x5F && char2 === 0x5F) {
        return '__';
      }
    }
    return null;
  }

  /**
   * Gets the italic marker type (* or _) from source text.
   * Optimized to use character code comparisons instead of string allocation.
   */
  private getItalicMarker(text: string, pos: number): string | null {
    if (pos + 1 <= text.length) {
      const charCode = text.charCodeAt(pos);
      
      // Check for '*' (asterisk = 0x2A)
      if (charCode === 0x2A) {
        return '*';
      }
      
      // Check for '_' (underscore = 0x5F)
      if (charCode === 0x5F) {
        return '_';
      }
    }
    return null;
  }

  /** Minimum length required for frontmatter delimiter */
  private static readonly MIN_FRONTMATTER_LENGTH = 3; // '---'

  /** 
   * Maximum number of lines to search for closing frontmatter delimiter.
   * 
   * Frontmatter is typically very short (< 50 lines). This limit prevents
   * performance issues when searching for closing delimiter in large files
   * where frontmatter might be incomplete or missing.
   */
  private static readonly MAX_FRONTMATTER_SEARCH_LINES = 100;

  /**
   * Processes YAML frontmatter at the start of the document.
   * 
   * Detects `---` delimiters at document start (after optional spaces/tabs only),
   * finds the closing delimiter, and applies a decoration to the entire block.
   * Frontmatter must be at the document start to distinguish it from horizontal rules.
   * 
   * @private
   * @param {string} text - The normalized markdown text (CRLF normalized to LF)
   * @param {DecorationRange[]} decorations - Array to accumulate decorations
   */
  private processFrontmatter(text: string, decorations: DecorationRange[]): void {
    if (!text || text.length < MarkdownParser.MIN_FRONTMATTER_LENGTH) {
      return;
    }

    // Find the start of the document (skip leading spaces/tabs only, not newlines)
    // This ensures frontmatter is truly at document start, not after content
    let startPos = 0;
    while (startPos < text.length && (text[startPos] === ' ' || text[startPos] === '\t')) {
      startPos++;
    }

    // Check if document starts with ---
    if (startPos + MarkdownParser.MIN_FRONTMATTER_LENGTH > text.length || 
        text.substring(startPos, startPos + MarkdownParser.MIN_FRONTMATTER_LENGTH) !== '---') {
      return;
    }

    // Find the end of the opening delimiter line
    const openingDelimiterStart = startPos;
    const openingLineEnd = text.indexOf('\n', openingDelimiterStart);
    if (openingLineEnd === -1) {
      // No newline found - document ends after opening delimiter
      // This is not valid frontmatter (needs closing delimiter)
      return;
    }
    const openingLineEndPos = openingLineEnd + 1; // Include the newline

    // Search for closing delimiter starting after the opening line
    // Look for a line that contains only --- (with optional whitespace)
    // Limit search to prevent performance issues with large files
    let searchPos = openingLineEndPos;
    let linesSearched = 0;
    while (searchPos < text.length && linesSearched < MarkdownParser.MAX_FRONTMATTER_SEARCH_LINES) {
      // Find next line start
      const lineStart = searchPos;
      let lineStartPos = lineStart;
      
      // Skip whitespace at line start
      while (lineStartPos < text.length && /\s/.test(text[lineStartPos])) {
        lineStartPos++;
      }

      // Check if this line starts with ---
      if (lineStartPos + MarkdownParser.MIN_FRONTMATTER_LENGTH <= text.length && 
          text.substring(lineStartPos, lineStartPos + MarkdownParser.MIN_FRONTMATTER_LENGTH) === '---') {
        // Found potential closing delimiter - validate the entire line
        const closingDelimiterStart = lineStartPos;
        const closingLineEnd = text.indexOf('\n', closingDelimiterStart);
        const lineEnd = closingLineEnd === -1 ? text.length : closingLineEnd;
        const lineContent = text.substring(lineStartPos, lineEnd);
        
        // Validate: closing delimiter line must contain only --- with optional whitespace
        // This prevents false matches like "--- some text" or "---comment"
        if (!/^---\s*$/.test(lineContent)) {
          // Not a valid closing delimiter, continue searching
          const nextLine = closingLineEnd === -1 ? text.length : closingLineEnd + 1;
          searchPos = nextLine;
          linesSearched++;
          continue;
        }

        // Validate: closing delimiter must be on its own line (only whitespace before it)
        const lineBeforeDelimiter = text.substring(lineStart, lineStartPos);
        const isOnlyWhitespaceBefore = /^\s*$/.test(lineBeforeDelimiter);
        
        if (isOnlyWhitespaceBefore) {
          // Found valid frontmatter block
          // End decoration at the end of the closing delimiter line, NOT including the newline after it
          // This ensures the decoration stops exactly at the closing --- line
          const closingLineEndPos = closingLineEnd === -1 
            ? closingDelimiterStart + MarkdownParser.MIN_FRONTMATTER_LENGTH  // End at end of --- (no newline, end of document)
            : closingLineEnd;             // End at newline position (exclusive, so newline is not included)
          
          // Apply decoration to entire block from opening delimiter start to end of closing delimiter line
          decorations.push({
            startPos: openingDelimiterStart,
            endPos: closingLineEndPos,
            type: 'frontmatter',
          });
        }
        return;
      }

      // Move to next line
      const nextLine = text.indexOf('\n', searchPos);
      if (nextLine === -1) {
        break;
      }
      searchPos = nextLine + 1;
      linesSearched++;
    }

    // No closing delimiter found - not valid frontmatter, don't apply decoration
  }

}
