import type { Root, Node, Strong, Emphasis, Heading, InlineCode, Code, Link, Image, Delete, Blockquote, ListItem, ThematicBreak } from 'mdast';
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
  | 'checkboxUnchecked'
  | 'checkboxChecked'
  | 'horizontalRule';

/**
 * Parser for extracting decoration ranges from markdown text.
 * 
 * Uses remark to parse markdown and extract positions for:
 * - Syntax markers (to hide)
 * - Content (to style with bold, italic, headings, etc.)
 * 
 * @class MarkdownParser
 * @example
 * // For sync usage (VS Code extension):
 * const parser = new MarkdownParser();
 * const decorations = parser.extractDecorations('# Heading\n**bold** text');
 * 
 * // For async usage (tests with ESM modules):
 * const parser = await MarkdownParser.create();
 * const decorations = parser.extractDecorations('# Heading\n**bold** text');
 */
export class MarkdownParser {
  private processor: any;
  private visit: any;

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

    this.addMarkerDecorations(decorations, start, end, markerLength, 'code');
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
   * For unordered lists (-, *, +): Replaces list markers with a bullet point (•).
   * For ordered lists (1., 2., etc.): Leaves markers visible (displayed as-is).
   * Detects and decorates checkboxes ([ ] or [x]) after the marker for both types.
   * 
   * Note: Ordered list auto-numbering is planned for a future release.
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
      if (this.tryAddCheckboxDecorations(text, markerStart, markerEnd, end, decorations)) {
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
        
        // Try to detect and add checkbox
        if (this.tryAddCheckboxDecorations(text, markerStart, markerEnd, end, decorations)) {
          return;
        }
        
        // Ordered lists without checkboxes should not be decorated (displayed as-is)
        // This prevents ordered lists from being rendered as unordered lists with bullets
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
   * @returns true if checkbox was found and decorations were added, false otherwise
   */
  private tryAddCheckboxDecorations(
    text: string,
    markerStart: number,
    markerEnd: number,
    end: number,
    decorations: DecorationRange[]
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
    
    decorations.push({
      startPos: markerStart,
      endPos: checkboxStart,
      type: 'listItem',
    });
    
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
   */
  private processThematicBreak(
    node: ThematicBreak,
    text: string,
    decorations: DecorationRange[]
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Replace the entire horizontal rule text with a decoration
    decorations.push({
      startPos: start,
      endPos: end,
      type: 'horizontalRule',
    });
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

}
