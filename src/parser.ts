import type {
  Root,
  Node,
  Strong,
  Emphasis,
  Heading,
  InlineCode,
  Code,
  Link,
  Image,
  Delete,
  Blockquote,
  ListItem,
  ThematicBreak,
  Text,
  Table,
  TableCell,
} from "mdast";
import { getRemarkProcessorSync, getRemarkProcessor } from "./parser-remark";
import { getEmojiMap } from "./emoji-map-loader";
import { scanMathRegions } from "./math/math-scanner";
import { config } from "./config";

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
  emoji?: string; // Emoji character for emoji shortcode replacements
  replacement?: string; // Replacement text for table pipe/cell decorations
  cellStyle?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
  };
  slug?: string; // For type 'mention': segment after @ (e.g. username, org/team). Used by link provider to resolve URL. 
  issueNumber?: number; // For type 'issueReference': issue/PR number. Used by link provider to resolve URL.
  ownerRepo?: string; // For type 'issueReference' when repo-scoped (@user/repo#456): the "user/repo" part.
}

/**
 * Represents a markdown construct scope (e.g., **bold**, [link](url)).
 * Positions are in normalized text offsets (LF line endings).
 */
export interface ScopeRange {
  startPos: number;
  endPos: number;
  kind?: string;
}

export interface MermaidBlock {
  startPos: number;
  endPos: number;
  source: string;
  /**
   * Number of lines in `source` (1 + newline count).
   *
   * Precomputed during parsing to avoid re-counting on every selection change.
   */
  numLines: number;
}

/**
 * One detected math span (inline $...$ or block $$...$$).
 * Positions are in normalized document text (LF line endings).
 * For fence-derived regions: startPos/endPos span the whole fenced block; source is body only; numLines is body line count for height.
 */
export interface MathRegion {
  startPos: number;
  endPos: number;
  source: string;
  displayMode: boolean;
  /** Body line count for fence-derived display math; used for height = (numLines + 2) × line height. Omitted for delimiter math. */
  numLines?: number;
}

/**
 * Result of parsing markdown for decorations and scopes.
 */
export interface ParseResult {
  decorations: DecorationRange[];
  scopes: ScopeRange[];
  mermaidBlocks: MermaidBlock[];
  mathRegions: MathRegion[];
}

/**
 * Types of decorations that can be applied to markdown content.
 */
export type DecorationType =
  | "hide"
  | "transparent"
  // Selection overlay used by the Decorator (not emitted by the parser)
  | "selectionOverlay"
  // Ghost-faint markers used by the Decorator (not emitted by the parser)
  | "ghostFaint"
  | "emoji"
  | "bold"
  | "italic"
  | "boldItalic"
  | "strikethrough"
  | "code"
  | "codeBlock"
  | "codeBlockLanguage"
  | "heading"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "link"
  | "image"
  | "blockquote"
  | "listItem"
  | "orderedListItem"
  | "checkboxUnchecked"
  | "checkboxChecked"
  | "horizontalRule"
  | "frontmatter"
  | "frontmatterDelimiter"
  | "tablePipe"
  | "tableSeparatorPipe"
  | "tableSeparatorDash"
  | "tableCell"
  | "mention"
  | "issueReference";

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
  visitor: (node: Node, index?: number, parent?: Node) => void,
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
    this.processor = unified().use(remarkParse).use(remarkGfm);
  }

  /**
   * Async factory method to create a MarkdownParser instance.
   * Uses dynamic imports to support ESM modules in test environments.
   *
   * @returns {Promise<MarkdownParser>} A promise that resolves to a MarkdownParser instance
   */
  static async create(): Promise<MarkdownParser> {
    const parser = Object.create(MarkdownParser.prototype);
    const { unified, remarkParse, remarkGfm, visit } =
      await getRemarkProcessor();
    parser.visit = visit;
    parser.processor = unified().use(remarkParse).use(remarkGfm);
    return parser;
  }

  /**
   * Extracts decoration ranges from markdown text.
   *
   * @param {string} text - The markdown text to parse
   * @returns {DecorationRange[]} Array of decoration ranges, sorted by startPos
   */
  extractDecorations(text: string): DecorationRange[] {
    return this.extractDecorationsWithScopes(text).decorations;
  }

  /**
   * Extracts decoration ranges and explicit scope ranges from markdown text.
   *
   * @param {string} text - The markdown text to parse
   * @returns {ParseResult} Decorations and scopes, sorted by startPos
   */
  extractDecorationsWithScopes(text: string): ParseResult {
    if (!text || typeof text !== "string") {
      return {
        decorations: [],
        scopes: [],
        mermaidBlocks: [],
        mathRegions: [],
      };
    }

    // Normalize line endings to \n for consistent position tracking
    // Optimization: Only normalize if document contains CRLF
    const normalizedText =
      text.indexOf("\r") !== -1 ? text.replace(/\r\n|\r/g, "\n") : text;

    const decorations: DecorationRange[] = [];
    const scopes: ScopeRange[] = [];
    const mermaidBlocks: MermaidBlock[] = [];

    // Process frontmatter before remark parsing to avoid conflicts with thematic break detection
    this.processFrontmatter(normalizedText, decorations, scopes);

    try {
      // Parse markdown into AST
      const ast = this.processor.parse(normalizedText) as Root;

      // Process AST nodes and extract decorations + scopes
      this.processAST(ast, normalizedText, decorations, scopes, mermaidBlocks);

      // Handle edge cases: empty image alt text that remark doesn't parse as Image node
      this.handleEmptyImageAlt(normalizedText, decorations);

      // GitHub-style mentions and issue references (@username, @org/team, #123, @user/repo#456)
      if (config.mentions.enabled()) {
        this.scanMentionAndIssueRefs(normalizedText, decorations, scopes);
      }

      // Safety net: Remove any markdown formatting decorations that fall within code blocks
      // Ancestor checks in processors prevent most cases, but this catches edge cases
      this.filterDecorationsInCodeBlocks(decorations, scopes, normalizedText);

      // Sort decorations by start position
      decorations.sort((a, b) => a.startPos - b.startPos);
    } catch (error) {
      // Gracefully handle parse errors
      console.error("Error parsing markdown:", error);
    }

    return {
      decorations,
      scopes: this.dedupeScopes(scopes),
      mermaidBlocks,
      mathRegions: scanMathRegions(normalizedText),
    };
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
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    mermaidBlocks: MermaidBlock[],
  ): void {
    // Track processed blockquote positions to avoid duplicates from nested blockquotes
    const processedBlockquotePositions = new Set<number>();

    // Use a map to efficiently track ancestors for each node
    const ancestorMap = new Map<Node, Node[]>();

    this.visit(
      ast,
      (node: Node, index: number | undefined, parent: Node | undefined) => {
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
            case "heading":
              this.processHeading(
                node as Heading,
                text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;

            case "strong":
              this.processStrong(
                node as Strong,
                text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;

            case "emphasis":
              this.processEmphasis(
                node as Emphasis,
                text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;

            case "delete":
              this.processStrikethrough(
                node as Delete,
                text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;

            case "inlineCode":
              this.processInlineCode(
                node as InlineCode,
                text,
                decorations,
                scopes,
              );
              break;

            case "code":
              this.processCodeBlock(
                node as Code,
                text,
                decorations,
                scopes,
                mermaidBlocks,
              );
              break;

            case "link":
              this.processLink(
                node as Link,
                text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;

            case "image":
              this.processImage(
                node as Image,
                text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;

            case "blockquote":
              this.processBlockquote(
                node as Blockquote,
                text,
                decorations,
                scopes,
                processedBlockquotePositions,
                currentAncestors,
              );
              break;

            case "listItem":
              this.processListItem(
                node as ListItem,
                text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;

            case "thematicBreak":
              this.processThematicBreak(
                node as ThematicBreak,
                text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;

            case "text":
              this.processText(
                node as Text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;

            case "table":
              this.processTable(
                node as Table,
                text,
                decorations,
                scopes,
                currentAncestors,
              );
              break;
          }
        } catch (error) {
          // Gracefully handle invalid positions or processing errors
          // Individual methods still validate, so this catches unexpected issues
          console.warn("Error processing AST node:", node.type, error);
        }
      },
    );
  }

  /**
   * Validates that a node has valid position information.
   * @returns {boolean} True if node position is valid
   */
  private hasValidPosition(node: Node): boolean {
    return !!(
      node.position &&
      node.position.start.offset !== undefined &&
      node.position.end.offset !== undefined
    );
  }

  /**
   * Checks if any ancestor node is a code block (fenced or inline).
   * Used to skip processing markdown formatting inside code blocks.
   *
   * @param ancestors - Array of ancestor nodes to check
   * @returns {boolean} True if any ancestor is a code block
   */
  private isInCodeBlock(ancestors: Node[]): boolean {
    return ancestors.some((a) => a.type === "code" || a.type === "inlineCode");
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
    contentType: DecorationType,
  ): void {
    const contentStart = start + markerLength;
    const contentEnd = end - markerLength;

    // Hide opening marker
    decorations.push({ startPos: start, endPos: contentStart, type: "hide" });

    // Add content decoration
    if (contentStart < contentEnd) {
      decorations.push({
        startPos: contentStart,
        endPos: contentEnd,
        type: contentType,
      });
    }

    // Hide closing marker
    decorations.push({ startPos: contentEnd, endPos: end, type: "hide" });
  }

  /**
   * Adds a scope range for a markdown construct if valid.
   */
  private addScope(
    scopes: ScopeRange[],
    startPos: number,
    endPos: number,
    kind?: string,
  ): void {
    if (startPos < endPos) {
      scopes.push({ startPos, endPos, kind });
    }
  }

  /**
   * Deduplicates and sorts scopes by start position.
   */
  private dedupeScopes(scopes: ScopeRange[]): ScopeRange[] {
    if (scopes.length === 0) {
      return [];
    }

    const unique = new Map<string, ScopeRange>();
    for (const scope of scopes) {
      const key = `${scope.startPos}:${scope.endPos}`;
      if (!unique.has(key)) {
        unique.set(key, scope);
      }
    }

    return Array.from(unique.values()).sort((a, b) => {
      if (a.startPos !== b.startPos) {
        return a.startPos - b.startPos;
      }
      return a.endPos - b.endPos;
    });
  }

  /**
   * Scans normalized text for GitHub-style @mentions and #issue references.
   * Pushes decoration ranges and scopes; excludes code blocks and email patterns.
   */
  private scanMentionAndIssueRefs(
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
  ): void {
    const codeRanges = this.getCodeBlockRanges(scopes);
    const inCode = (start: number, end: number) =>
      codeRanges.some((r) => start < r.end && end > r.start);
    const occupiedIssueRanges: Array<{ start: number; end: number }> = [];
    const overlapsIssueRange = (start: number, end: number) =>
      occupiedIssueRanges.some((r) => start < r.end && end > r.start);

    // Match @user/repo#456 first (repo-scoped issue), then @org/team, then @username, then #123
    const repoScopedRefRe =
      /@([a-zA-Z0-9][a-zA-Z0-9-]*)\/([a-zA-Z0-9][a-zA-Z0-9-]*)#(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = repoScopedRefRe.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (inCode(start, end)) continue;
      if (this.looksLikeEmailAt(text, start)) continue;
      const ownerRepo = `${m[1]}/${m[2]}`;
      decorations.push({
        startPos: start,
        endPos: end,
        type: "issueReference",
        issueNumber: parseInt(m[3], 10),
        ownerRepo,
      });
      occupiedIssueRanges.push({ start, end });
      this.addScope(scopes, start, end, "issueReference");
    }

    // @org/team (exactly one slash, token boundary after team segment)
    const orgTeamRe =
      /@([a-zA-Z0-9][a-zA-Z0-9-]*)\/([a-zA-Z0-9][a-zA-Z0-9-]*)(?=$|[^a-zA-Z0-9-])/g;
    while ((m = orgTeamRe.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (inCode(start, end)) continue;
      if (this.looksLikeEmailAt(text, start)) continue;
      // Repo-scoped refs (@owner/repo#123) are handled above as issueReference.
      if (text[end] === "#") continue;
      decorations.push({
        startPos: start,
        endPos: end,
        type: "mention",
        slug: `${m[1]}/${m[2]}`,
      });
      this.addScope(scopes, start, end, "mention");
    }

    // @username (alphanumeric and hyphen, no leading hyphen)
    const userRe = /@([a-zA-Z0-9][a-zA-Z0-9-]*)(?![a-zA-Z0-9_/-])/g;
    while ((m = userRe.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (inCode(start, end)) continue;
      if (this.looksLikeEmailAt(text, start)) continue;
      decorations.push({
        startPos: start,
        endPos: end,
        type: "mention",
        slug: m[1],
      });
      this.addScope(scopes, start, end, "mention");
    }

    // #123 (digits only)
    const issueRe = /#(\d+)/g;
    while ((m = issueRe.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (inCode(start, end)) continue;
      if (overlapsIssueRange(start, end)) continue;
      decorations.push({
        startPos: start,
        endPos: end,
        type: "issueReference",
        issueNumber: parseInt(m[1], 10),
      });
      this.addScope(scopes, start, end, "issueReference");
    }
  }

  /** Returns whether the @ at position atIdx appears to be part of an email (local@domain). */
  private looksLikeEmailAt(text: string, atIdx: number): boolean {
    let lo = atIdx - 1;
    while (lo >= 0 && /[a-zA-Z0-9._%+-]/.test(text[lo])) lo--;
    const localPart = text.slice(lo + 1, atIdx);
    let hi = atIdx + 1;
    while (hi < text.length && /[a-zA-Z0-9.-]/.test(text[hi])) hi++;
    const domainPart = text.slice(atIdx + 1, hi);
    if (!localPart.length || !domainPart.length) return false;
    if (!/\./.test(domainPart)) return false;
    return true;
  }

  /** Builds code block ranges from scopes for mention/ref exclusion. */
  private getCodeBlockRanges(
    scopes: ScopeRange[],
  ): Array<{ start: number; end: number }> {
    const out: Array<{ start: number; end: number }> = [];
    for (const scope of scopes) {
      if (scope.kind === "codeBlock" || scope.kind === "code") {
        out.push({ start: scope.startPos, end: scope.endPos });
      }
    }
    out.sort((a, b) => a.start - b.start);
    return out;
  }

  /**
   * Filters out markdown formatting decorations that fall within code blocks.
   *
   * This is a safety net: ancestor checks in processors prevent most cases, but this
   * catches any edge cases where decorations might still be created inside code blocks.
   *
   * Only code block specific decorations are preserved:
   * - codeBlock, codeBlockLanguage, code, transparent
   * - hide decorations that are part of fence structure (fence markers, newlines on fence lines)
   *
   * @param decorations - Array of decorations to filter (modified in place)
   * @param scopes - Array of scope ranges (used to identify code blocks)
   * @param text - The normalized markdown text (used to identify fence lines)
   */
  private filterDecorationsInCodeBlocks(
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    text: string,
  ): void {
    // Collect code block ranges and pre-compute opening line ends for fenced blocks
    const codeBlockRanges: Array<{
      start: number;
      end: number;
      isFenced: boolean;
      openingLineEnd?: number; // Pre-computed for fenced blocks
    }> = [];

    for (const scope of scopes) {
      if (scope.kind === "codeBlock") {
        // Pre-compute opening line end once per fenced code block
        const openingLineEnd = text.indexOf("\n", scope.startPos);
        codeBlockRanges.push({
          start: scope.startPos,
          end: scope.endPos,
          isFenced: true,
          openingLineEnd:
            openingLineEnd !== -1 ? openingLineEnd + 1 : undefined,
        });
      } else if (scope.kind === "code") {
        codeBlockRanges.push({
          start: scope.startPos,
          end: scope.endPos,
          isFenced: false,
        });
      }
    }
    if (codeBlockRanges.length === 0) {
      return;
    }

    // Sort ranges by start position for efficient lookup
    codeBlockRanges.sort((a, b) => a.start - b.start);

    // Find min/max bounds for early exit optimization
    const minCodeBlockStart = codeBlockRanges[0].start;
    const maxCodeBlockEnd = Math.max(...codeBlockRanges.map((r) => r.end));

    // Decorations that are always allowed inside code blocks
    const alwaysAllowed = new Set<DecorationType>([
      "codeBlock",
      "codeBlockLanguage",
      "code",
      "transparent",
    ]);

    // Remove all other decorations that fall within code blocks
    for (let i = decorations.length - 1; i >= 0; i--) {
      const decoration = decorations[i];

      // Always allowed decorations - fast path
      if (alwaysAllowed.has(decoration.type)) {
        continue;
      }

      // Early exit: decoration is before first code block or after last code block
      if (
        decoration.endPos <= minCodeBlockStart ||
        decoration.startPos >= maxCodeBlockEnd
      ) {
        continue;
      }

      // Find matching code block range (ranges are sorted, so we can stop early)
      let matchingRange: (typeof codeBlockRanges)[0] | undefined;
      for (const range of codeBlockRanges) {
        // Early exit if we've passed all possible matches
        if (decoration.startPos < range.start) {
          break;
        }
        // Check if decoration is inside this range
        if (
          decoration.startPos >= range.start &&
          decoration.endPos <= range.end
        ) {
          matchingRange = range;
          break;
        }
      }

      if (!matchingRange) {
        continue; // Not in a code block
      }

      // Special handling for hide decorations: only keep fence structure
      if (decoration.type === "hide" && matchingRange.isFenced) {
        // Fence markers are at boundaries: opening fence starts at range.start, closing fence ends at range.end
        const isOpeningFence = decoration.startPos === matchingRange.start;
        const isClosingFence = decoration.endPos === matchingRange.end;

        // Check if it's on the opening line (using pre-computed value)
        const isOnOpeningLine =
          matchingRange.openingLineEnd !== undefined &&
          decoration.startPos >= matchingRange.start &&
          decoration.endPos <= matchingRange.openingLineEnd;

        // Keep hide decorations that are clearly fence structure
        if (isOpeningFence || isClosingFence || isOnOpeningLine) {
          continue;
        }
        // Remove all other hide decorations inside fenced code blocks
        decorations.splice(i, 1);
        continue;
      }

      // For inline code blocks, remove all hide decorations (they use transparent, not hide)
      if (decoration.type === "hide" && !matchingRange.isFenced) {
        decorations.splice(i, 1);
        continue;
      }

      // Remove all other decorations inside code blocks
      decorations.splice(i, 1);
    }
  }

  /**
   * Processes a heading node.
   */
  private processHeading(
    node: Heading,
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse headings inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Find the heading marker (#) by checking the source text
    let markerLength = 0;
    let pos = start;
    while (pos < end && text[pos] === "#") {
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
      type: "hide",
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
        type: "heading",
      });
    }

    this.addScope(scopes, start, contentEnd, "heading");
  }

  /**
   * Processes a strong (bold) node.
   *
   * Skips processing if the bold text is inside a code block or inline code,
   * as markdown formatting should not be parsed inside code contexts.
   */
  private processStrong(
    node: Strong,
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse bold inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Determine marker type by checking source text (** or __)
    const marker = this.getBoldMarker(text, start);
    if (!marker) return;

    const markerLength = marker.length;

    // Check if this is bold+italic (nested with emphasis)
    const isBoldItalic = ancestors.some((a) => a.type === "emphasis");
    const contentType: DecorationType = isBoldItalic ? "boldItalic" : "bold";

    this.addMarkerDecorations(
      decorations,
      start,
      end,
      markerLength,
      contentType,
    );
    this.addScope(scopes, start, end, contentType);

    // Process children for nested decorations (handled by visit)
  }

  /**
   * Processes an emphasis (italic) node.
   *
   * Skips processing if the italic text is inside a code block or inline code,
   * as markdown formatting should not be parsed inside code contexts.
   */
  private processEmphasis(
    node: Emphasis,
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse italic inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Determine marker type by checking source text
    const marker = this.getItalicMarker(text, start);
    if (!marker) return;

    const markerLength = marker.length;

    // Skip if this emphasis is part of ***text*** pattern
    // In that case, strong node already handles the decoration
    const parentStrong = ancestors.find((a) => a.type === "strong");
    if (parentStrong && parentStrong.position) {
      const strongStart = parentStrong.position.start.offset ?? -1;
      const strongEnd = parentStrong.position.end.offset ?? -1;

      // Check if emphasis markers overlap with strong markers (***text*** case)
      if (start === strongStart + 2 && end === strongEnd - 2) {
        return; // Strong node already applied boldItalic decoration
      }
    }

    // Check if this is bold+italic (nested with strong)
    const isBoldItalic = ancestors.some((a) => a.type === "strong");
    const contentType: DecorationType = isBoldItalic ? "boldItalic" : "italic";

    this.addMarkerDecorations(
      decorations,
      start,
      end,
      markerLength,
      contentType,
    );
    this.addScope(scopes, start, end, contentType);
  }

  /**
   * Processes a strikethrough (delete) node.
   *
   * Validates that the node actually uses ~~ (double tilde) markers,
   * not single ~, to prevent incorrect parsing of single tildes as strikethrough.
   *
   * Skips processing if the strikethrough text is inside a code block or inline code,
   * as markdown formatting should not be parsed inside code contexts.
   */
  private processStrikethrough(
    node: Delete,
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse strikethrough inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Validate that this is actually strikethrough (~~text~~) and not single tilde (~text~)
    // Check for double tilde at the start
    if (
      start + 1 >= text.length ||
      text[start] !== "~" ||
      text[start + 1] !== "~"
    ) {
      return; // Not a valid strikethrough marker
    }

    // Check for double tilde at the end
    if (end < 2 || text[end - 2] !== "~" || text[end - 1] !== "~") {
      return; // Not a valid strikethrough marker
    }

    // Strikethrough uses ~~ markers (length 2)
    this.addMarkerDecorations(decorations, start, end, 2, "strikethrough");
    this.addScope(scopes, start, end, "strikethrough");
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
    decorations: DecorationRange[],
    scopes: ScopeRange[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Count backticks at start to determine marker length
    let markerLength = 0;
    let pos = start;
    while (pos < end && text[pos] === "`") {
      markerLength++;
      pos++;
    }

    if (markerLength === 0) return;

    // Apply code decoration to ENTIRE range (including backticks)
    // This ensures the border spans the full code block
    decorations.push({ startPos: start, endPos: end, type: "code" });

    // Make backticks transparent (not hidden) - matches Markless approach
    // Using 'transparent' instead of 'hide' keeps backticks in layout,
    // which is required for borders to render correctly on single lines
    decorations.push({
      startPos: start,
      endPos: start + markerLength,
      type: "transparent",
    });
    decorations.push({
      startPos: end - markerLength,
      endPos: end,
      type: "transparent",
    });

    this.addScope(scopes, start, end, "code");
  }

  /**
   * Processes a code block node.
   *
   * Supports both backtick (```) and tilde (~~~) fences, with variable length (3+ characters).
   * Detects the fence type and length from the text to properly handle all GFM code block variants.
   */
  private processCodeBlock(
    node: Code,
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    mermaidBlocks: MermaidBlock[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    const codeStart = node.position!.start.offset!;
    const codeEnd = node.position!.end.offset!;

    // Detect opening fence: scan from codeStart backwards to find fence start
    // The fence should be at the start of a line (or after only whitespace)
    let fenceStart = codeStart;
    let fenceChar: string | null = null;
    let fenceLength = 0;

    // Find the line start before the code block
    const lineStart = text.lastIndexOf("\n", codeStart - 1) + 1;

    // Scan from line start to find the fence
    for (let pos = lineStart; pos < codeStart && pos < text.length; pos++) {
      const char = text[pos];
      if (char === "`" || char === "~") {
        // Count consecutive fence characters
        let count = 1;
        let checkPos = pos + 1;
        while (
          checkPos < text.length &&
          text[checkPos] === char &&
          count < 20
        ) {
          count++;
          checkPos++;
        }

        // Valid fence must be 3+ characters
        if (count >= 3) {
          fenceStart = pos;
          fenceChar = char;
          fenceLength = count;
          break;
        }
      }
    }

    // Fallback: if no fence found, try searching forward from codeStart
    if (!fenceChar) {
      for (
        let pos = codeStart;
        pos < Math.min(codeStart + 20, text.length);
        pos++
      ) {
        const char = text[pos];
        if (char === "`" || char === "~") {
          let count = 1;
          let checkPos = pos + 1;
          while (
            checkPos < text.length &&
            text[checkPos] === char &&
            count < 20
          ) {
            count++;
            checkPos++;
          }
          if (count >= 3) {
            fenceStart = pos;
            fenceChar = char;
            fenceLength = count;
            break;
          }
        }
      }
    }

    if (!fenceChar || fenceLength < 3) {
      // Final fallback: assume standard ``` backticks
      const fallbackFence = text.indexOf("```", codeStart - 10);
      if (fallbackFence === -1 || fallbackFence > codeStart) return;
      fenceStart = fallbackFence;
      fenceChar = "`";
      fenceLength = 3;
    }

    // Find closing fence: scan backwards from codeEnd
    let closingFence = -1;
    const closingLineStart = text.lastIndexOf("\n", codeEnd - 1) + 1;

    // Search backwards from codeEnd to find closing fence
    for (
      let pos = codeEnd - 1;
      pos >= closingLineStart && pos >= fenceStart + fenceLength;
      pos--
    ) {
      if (text[pos] === fenceChar) {
        // Count consecutive fence characters backwards
        let count = 1;
        let checkPos = pos - 1;
        while (checkPos >= 0 && text[checkPos] === fenceChar && count < 20) {
          count++;
          checkPos--;
        }

        // Closing fence must be at least as long as opening fence
        if (count >= fenceLength) {
          closingFence = pos - count + 1;
          break;
        }
      }
    }

    if (closingFence === -1) {
      // Fallback: search forward from codeEnd
      for (
        let pos = codeEnd;
        pos < Math.min(codeEnd + 20, text.length);
        pos++
      ) {
        if (text[pos] === fenceChar) {
          let count = 1;
          let checkPos = pos + 1;
          while (
            checkPos < text.length &&
            text[checkPos] === fenceChar &&
            count < 20
          ) {
            count++;
            checkPos++;
          }
          if (count >= fenceLength) {
            closingFence = pos;
            break;
          }
        }
      }
    }

    if (closingFence === -1 || closingFence <= fenceStart) return;

    // Find the end of the opening fence line (including language identifier and newline)
    const openingLineEnd = text.indexOf("\n", fenceStart);
    const openingFenceEnd = fenceStart + fenceLength;

    // Find the end of the closing fence
    const closingFenceEnd = closingFence + fenceLength;

    // Find if there's a newline after the closing fence
    const closingLineEnd = text.indexOf("\n", closingFence);
    const closingEnd = closingLineEnd !== -1 ? closingLineEnd + 1 : codeEnd;

    const isMermaid = node.lang?.trim() === "mermaid";

    if (!isMermaid) {
      // Apply code block background to the entire block including fence lines
      // but NOT including the newline after the closing fence
      decorations.push({
        startPos: fenceStart,
        endPos: closingFenceEnd,
        type: "codeBlock",
      });

      // Hide the opening fence markers
      decorations.push({
        startPos: fenceStart,
        endPos: openingFenceEnd,
        type: "hide",
      });

      // Find language identifier (between fence and newline)
      const languageStart = openingFenceEnd;
      const languageEnd =
        openingLineEnd !== -1 && openingLineEnd < closingFence
          ? openingLineEnd
          : openingFenceEnd;

      // Apply language identifier decoration if there's a language (not just whitespace)
      if (languageEnd > languageStart) {
        const languageText = text.substring(languageStart, languageEnd).trim();
        if (languageText.length > 0) {
          decorations.push({
            startPos: languageStart,
            endPos: languageEnd,
            type: "codeBlockLanguage",
          });
        }
      }

      // Hide the newline after the language identifier (if present)
      if (openingLineEnd !== -1 && openingLineEnd < closingFence) {
        decorations.push({
          startPos: openingLineEnd,
          endPos: openingLineEnd + 1,
          type: "hide",
        });
      }

      // Hide the closing fence line (fence and newline if present)
      decorations.push({
        startPos: closingFence,
        endPos: closingEnd,
        type: "hide",
      });
    } else {
      // For Mermaid blocks, hide the fence markers so only the SVG shows
      // Hide the opening fence markers (```mermaid)
      decorations.push({
        startPos: fenceStart,
        endPos: openingFenceEnd,
        type: "hide",
      });

      // Find language identifier (between fence and newline) and hide it
      const languageStart = openingFenceEnd;
      const languageEnd =
        openingLineEnd !== -1 && openingLineEnd < closingFence
          ? openingLineEnd
          : openingFenceEnd;

      if (languageEnd > languageStart) {
        decorations.push({
          startPos: languageStart,
          endPos: languageEnd,
          type: "hide",
        });
      }

      // Hide the newline after the language identifier (if present)
      if (openingLineEnd !== -1 && openingLineEnd < closingFence) {
        decorations.push({
          startPos: openingLineEnd,
          endPos: openingLineEnd + 1,
          type: "hide",
        });
      }

      // Hide the closing fence line (```)
      decorations.push({
        startPos: closingFence,
        endPos: closingEnd,
        type: "hide",
      });
    }

    this.addScope(scopes, fenceStart, closingEnd, "codeBlock");

    if (isMermaid) {
      const source = node.value ?? "";
      // Fast newline count (avoid regex allocations in hot paths).
      let numLines = 1;
      for (let i = 0; i < source.length; i++) {
        if (source.charCodeAt(i) === 10 /* '\n' */) {
          numLines++;
        }
      }
      mermaidBlocks.push({
        startPos: fenceStart,
        endPos: closingEnd,
        source,
        numLines,
      });
    }
  }

  /**
   * Processes a link node.
   *
   * Skips processing if the link is inside a code block or inline code,
   * as links should not be parsed inside code contexts.
   */
  private processLink(
    node: Link,
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse links inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Explicit bracket-style link [text](url): always use regular link rendering so that
    // [bob@email.com](mailto:bob@email.com) and [url](url) hide delimiters and URL.
    if (text[start] === "[") {
      // Fall through to "Regular bracket-style link" path below.
    } else {
      // Detect autolinks and bare links using AST structure: link text equals the URL
      // (or URL without mailto: prefix for email autolinks)
      const firstChild = node.children?.[0];
      const linkText =
        firstChild && firstChild.type === "text" ? firstChild.value : "";
      const url = node.url || "";
      const urlWithoutMailto = url.replace(/^mailto:/, "");
      const isAutolinkOrBareLink =
        linkText === url || linkText === urlWithoutMailto;

      if (isAutolinkOrBareLink) {
        // Check if it's an autolink (has angle brackets) or bare link (no brackets)
        const hasAngleBrackets = text[start] === "<" && text[end - 1] === ">";

        if (hasAngleBrackets) {
          // Process autolink - use text child position for accurate content range
          const textChild =
            firstChild && firstChild.type === "text" ? firstChild : null;
          const contentStart = textChild?.position?.start.offset ?? start + 1;
          const contentEnd = textChild?.position?.end.offset ?? end - 1;

          // Hide opening angle bracket
          decorations.push({
            startPos: start,
            endPos: start + 1,
            type: "hide",
          });

          // Add link decoration for content (between angle brackets)
          if (contentStart < contentEnd) {
            decorations.push({
              startPos: contentStart,
              endPos: contentEnd,
              type: "link",
              url: url, // Use URL from AST (remark-gfm already handles mailto: for emails)
            });
          }

          // Hide closing angle bracket
          decorations.push({
            startPos: end - 1,
            endPos: end,
            type: "hide",
          });

          // Add scope for reveal-on-select behavior
          this.addScope(scopes, start, end, "link");
        } else {
          // Process bare link (no angle brackets) - just apply link decoration
          const textChild =
            firstChild && firstChild.type === "text" ? firstChild : null;
          const contentStart = textChild?.position?.start.offset ?? start;
          const contentEnd = textChild?.position?.end.offset ?? end;

          // Add link decoration for the URL/email text
          if (contentStart < contentEnd) {
            decorations.push({
              startPos: contentStart,
              endPos: contentEnd,
              type: "link",
              url: url, // Use URL from AST (remark-gfm already handles mailto: for emails)
            });
          }

          // Add scope for reveal-on-select behavior
          this.addScope(scopes, start, end, "link");
        }
        return;
      }
    }

    // Regular bracket-style link: [text](url)
    // Find opening bracket [
    const bracketStart = text.indexOf("[", start);
    if (bracketStart === -1) return;

    // Find closing bracket ]
    const bracketEnd = text.indexOf("]", bracketStart);
    if (bracketEnd === -1) return;

    // Hide opening bracket
    decorations.push({
      startPos: bracketStart,
      endPos: bracketStart + 1,
      type: "hide",
    });

    // Add link decoration for text (between brackets)
    const contentStart = bracketStart + 1;
    if (contentStart < bracketEnd) {
      // Extract URL from the link node
      const url = node.url || "";

      decorations.push({
        startPos: contentStart,
        endPos: bracketEnd,
        type: "link",
        url: url,
      });
    }

    // Hide closing bracket
    decorations.push({
      startPos: bracketEnd,
      endPos: bracketEnd + 1,
      type: "hide",
    });

    // Find and hide URL part (url)
    const parenStart = text.indexOf("(", bracketEnd);
    if (parenStart !== -1 && parenStart === bracketEnd + 1) {
      // Hide opening parenthesis
      decorations.push({
        startPos: parenStart,
        endPos: parenStart + 1,
        type: "hide",
      });

      const parenEnd = text.indexOf(")", parenStart + 1);
      if (parenEnd !== -1 && parenEnd <= end) {
        // Hide URL content between parentheses
        const urlStart = parenStart + 1;
        if (urlStart < parenEnd) {
          decorations.push({
            startPos: urlStart,
            endPos: parenEnd,
            type: "hide",
          });
        }

        // Hide closing parenthesis
        decorations.push({
          startPos: parenEnd,
          endPos: parenEnd + 1,
          type: "hide",
        });
      }
    }

    this.addScope(scopes, start, end, "link");
  }

  /**
   * Processes an image node.
   */
  private processImage(
    node: Image,
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse images inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Find opening ![
    const exclamationStart = text.indexOf("![", start);
    if (exclamationStart === -1 || exclamationStart > start) return;

    // Hide ![
    decorations.push({
      startPos: exclamationStart,
      endPos: exclamationStart + 2,
      type: "hide",
    });

    // Find alt text (between [ and ])
    const altStart = exclamationStart + 2;
    const bracketEnd = text.indexOf("]", altStart);
    if (bracketEnd === -1) {
      // Even if no closing bracket found, try to hide what we can
      // This handles edge cases like ![] without proper syntax
      return;
    }

    // Add image decoration for alt text (even if empty)
    if (altStart <= bracketEnd) {
      const url = node.url || "";
      decorations.push({
        startPos: altStart,
        endPos: bracketEnd,
        type: "image",
        url,
      });

      // Image nodes from remark store alt text as a string (no child nodes),
      // so inline formatting like **bold** and *italic* inside the alt text
      // is not parsed by the main AST walk. We parse the alt slice separately
      // and add inline formatting decorations within the alt range.
      if (altStart < bracketEnd) {
        this.processInlineFormattingInImageAlt(
          text,
          decorations,
          scopes,
          altStart,
          bracketEnd,
        );
        this.processEmojiShortcodesInSlice(
          text.substring(altStart, bracketEnd),
          altStart,
          decorations,
          scopes,
        );
      }
    }

    // Hide closing bracket
    decorations.push({
      startPos: bracketEnd,
      endPos: bracketEnd + 1,
      type: "hide",
    });

    // Find and hide URL part
    const parenStart = text.indexOf("(", bracketEnd);
    if (parenStart !== -1) {
      // Allow for optional space between ] and (
      const between = text.substring(bracketEnd + 1, parenStart);
      const hasOnlyWhitespaceBetween =
        between.length > 0 && between.trim().length === 0;
      if (parenStart === bracketEnd + 1 || hasOnlyWhitespaceBetween) {
        // Hide whitespace between ] and ( if present
        if (hasOnlyWhitespaceBetween) {
          decorations.push({
            startPos: bracketEnd + 1,
            endPos: parenStart,
            type: "hide",
          });
        }

        decorations.push({
          startPos: parenStart,
          endPos: parenStart + 1,
          type: "hide",
        });

        const parenEnd = text.indexOf(")", parenStart + 1);
        if (parenEnd !== -1 && parenEnd <= end) {
          const urlStart = parenStart + 1;
          if (urlStart < parenEnd) {
            decorations.push({
              startPos: urlStart,
              endPos: parenEnd,
              type: "hide",
            });
          }

          decorations.push({
            startPos: parenEnd,
            endPos: parenEnd + 1,
            type: "hide",
          });
        }
      }
    }

    this.addScope(scopes, start, end, "image");
  }

  /**
   * Parses inline markdown inside an image's alt text and emits decorations.
   *
   * Remark's mdast `image` node stores `alt` as a plain string (no inline children),
   * so formatting inside the alt text is not present in the main AST traversal.
   *
   * This method parses only the alt slice (fast path + early exits) and maps the
   * resulting node positions back into the original (normalized) document offsets.
   *
   * Note: This is only called for images that are NOT inside code blocks (checked in processImage).
   */
  private processInlineFormattingInImageAlt(
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    altStart: number,
    altEnd: number,
  ): void {
    if (altStart >= altEnd) return;

    const altText = text.substring(altStart, altEnd);

    // Fast path: avoid parsing when there are no inline marker characters
    const hasInlineMarkers =
      altText.indexOf("*") !== -1 ||
      altText.indexOf("_") !== -1 ||
      altText.indexOf("~") !== -1 ||
      altText.indexOf("`") !== -1;
    if (!hasInlineMarkers) return;

    let altAst: Root;
    try {
      altAst = this.processor.parse(altText) as Root;
    } catch {
      return;
    }

    const ancestorMap = new Map<Node, Node[]>();
    const absCache = new WeakMap<Node, Node>();

    const toAbsoluteNode = <T extends Node>(node: T): T => {
      const cached = absCache.get(node);
      if (cached) return cached as T;

      if (
        !node.position ||
        node.position.start.offset === undefined ||
        node.position.end.offset === undefined
      ) {
        absCache.set(node, node);
        return node;
      }

      const absNode = {
        ...node,
        position: {
          ...node.position,
          start: {
            ...node.position.start,
            offset: altStart + (node.position.start.offset ?? 0),
          },
          end: {
            ...node.position.end,
            offset: altStart + (node.position.end.offset ?? 0),
          },
        },
      } as T;

      absCache.set(node, absNode as unknown as Node);
      return absNode;
    };

    const toAbsoluteAncestors = (ancestors: Node[]): Node[] =>
      ancestors.map(toAbsoluteNode);

    this.visit(
      altAst,
      (node: Node, _index: number | undefined, parent: Node | undefined) => {
        const currentAncestors: Node[] = [];
        if (parent) {
          currentAncestors.push(parent);
          const parentAncestors = ancestorMap.get(parent);
          if (parentAncestors) {
            currentAncestors.push(...parentAncestors);
          }
        }

        if (currentAncestors.length > 0) {
          ancestorMap.set(node, currentAncestors);
        }

        try {
          switch (node.type) {
            case "strong":
              this.processStrong(
                toAbsoluteNode(node as Strong),
                text,
                decorations,
                scopes,
                toAbsoluteAncestors(currentAncestors),
              );
              break;
            case "emphasis":
              this.processEmphasis(
                toAbsoluteNode(node as Emphasis),
                text,
                decorations,
                scopes,
                toAbsoluteAncestors(currentAncestors),
              );
              break;
            case "delete":
              this.processStrikethrough(
                toAbsoluteNode(node as Delete),
                text,
                decorations,
                scopes,
                toAbsoluteAncestors(currentAncestors),
              );
              break;
            case "inlineCode":
              this.processInlineCode(
                toAbsoluteNode(node as InlineCode),
                text,
                decorations,
                scopes,
              );
              break;
          }
        } catch {
          // Be conservative: never fail the main image parsing because the alt slice is malformed.
        }
      },
    );
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
    scopes: ScopeRange[],
    processedPositions: Set<number>,
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse blockquotes inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Find all '>' markers at the start of lines within this blockquote
    // Blockquotes can span multiple lines, each starting with '>'
    let pos = start;
    while (pos < end) {
      // Find line start (either document start or after newline)
      const lineStart = pos === 0 ? 0 : text.lastIndexOf("\n", pos - 1) + 1;

      // Find all '>' markers on this line (for nested blockquotes like "> > >")
      // We process all '>' markers that are at the start of the line or after whitespace/other '>'
      let searchStart = lineStart;
      const lineEnd = text.indexOf("\n", lineStart);
      const actualLineEnd = lineEnd === -1 ? end : Math.min(lineEnd, end);

      while (searchStart < actualLineEnd) {
        const gtIndex = text.indexOf(">", searchStart);
        if (gtIndex === -1 || gtIndex >= actualLineEnd) break;

        // Check if we've already processed this position (from a parent blockquote node)
        if (processedPositions.has(gtIndex)) {
          searchStart = gtIndex + 1;
          continue;
        }

        // Check if there's only whitespace and/or '>' before this '>'
        // This allows nested blockquotes like "> > >" where each '>' is valid
        const beforeGt = text.substring(lineStart, gtIndex);
        const isBlockquoteMarker =
          beforeGt.trim().length === 0 || /^[\s>]*$/.test(beforeGt);

        if (isBlockquoteMarker) {
          // Mark this position as processed
          processedPositions.add(gtIndex);

          // Replace only the '>' character with blockquote decoration (vertical bar)
          // Keep the space after it visible to maintain proper spacing
          decorations.push({
            startPos: gtIndex,
            endPos: gtIndex + 1,
            type: "blockquote",
          });
          searchStart = gtIndex + 1;
        } else {
          // Not a blockquote marker, move past it
          searchStart = gtIndex + 1;
        }
      }

      // Move to next line
      const nextLine = text.indexOf("\n", pos);
      if (nextLine === -1 || nextLine >= end) break;
      pos = nextLine + 1;
    }

    this.addScope(scopes, start, end, "blockquote");
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
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse list items inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Find the list marker at the start of the list item
    let markerEnd = start;

    // Skip leading whitespace
    while (markerEnd < end && /\s/.test(text[markerEnd])) {
      markerEnd++;
    }

    if (markerEnd >= end) return;

    this.addScope(scopes, start, end, "listItem");

    const markerStart = markerEnd;

    // Check for unordered list markers: -, *, +
    if (
      text[markerEnd] === "-" ||
      text[markerEnd] === "*" ||
      text[markerEnd] === "+"
    ) {
      markerEnd++;
      // Skip optional space after marker
      if (markerEnd < end && text[markerEnd] === " ") {
        markerEnd++;
      }

      // Try to detect and add checkbox, otherwise add regular list item decoration
      if (
        this.tryAddCheckboxDecorations(
          text,
          markerStart,
          markerEnd,
          end,
          decorations,
          false,
        )
      ) {
        return;
      }

      decorations.push({
        startPos: markerStart,
        endPos: markerEnd,
        type: "listItem",
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
      if (numEnd < end && (text[numEnd] === "." || text[numEnd] === ")")) {
        markerEnd = numEnd + 1;
        // Skip optional space after marker
        if (markerEnd < end && text[markerEnd] === " ") {
          markerEnd++;
        }

        // For ordered lists: only add checkbox decoration if present, otherwise apply color styling
        // Ordered lists should NOT be decorated with listItem (bullet point)
        if (
          this.tryAddCheckboxDecorations(
            text,
            markerStart,
            markerEnd,
            end,
            decorations,
            true,
          )
        ) {
          return;
        }

        // Apply color decoration to ordered list markers to ensure they match regular text color
        decorations.push({
          startPos: markerStart,
          endPos: markerEnd,
          type: "orderedListItem",
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
    isOrderedList: boolean,
  ): boolean {
    // Check for checkbox pattern: [ ] or [x] or [X]
    // GFM requires a space after the closing bracket for task lists
    if (markerEnd + 3 >= end || text[markerEnd] !== "[") {
      return false;
    }

    const checkChar = text[markerEnd + 1];
    if (
      (checkChar !== " " && checkChar !== "x" && checkChar !== "X") ||
      text[markerEnd + 2] !== "]"
    ) {
      return false;
    }

    // GFM spec requires a space after the closing bracket for task lists
    // Without a space, it's not a valid task list (e.g., "- [x]task" is not a task list)
    if (text[markerEnd + 3] !== " ") {
      return false;
    }

    // Found a valid checkbox - add decorations
    const checkboxStart = markerEnd;
    const checkboxEnd = checkboxStart + 3; // [ ], [x], or [X] (space after is not part of checkbox)
    const isChecked = checkChar === "x" || checkChar === "X";

    // For ordered lists with checkboxes, apply color decoration to the numbers
    if (isOrderedList) {
      decorations.push({
        startPos: markerStart,
        endPos: markerEnd,
        type: "orderedListItem",
      });
    }
    // For unordered lists: no listItem (bullet); single checkbox decoration covers marker + checkbox
    decorations.push({
      startPos: isOrderedList ? checkboxStart : markerStart,
      endPos: checkboxEnd,
      type: isChecked ? "checkboxChecked" : "checkboxUnchecked",
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
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse horizontal rules inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;

    // Skip if this thematic break is within a frontmatter block
    // Frontmatter delimiters should not be processed as horizontal rules
    const isInFrontmatter = decorations.some(
      (d) => d.type === "frontmatter" && d.startPos <= start && d.endPos >= end,
    );

    if (isInFrontmatter) {
      return; // Skip processing this thematic break - it's part of frontmatter
    }

    // Replace the entire horizontal rule text with a decoration
    decorations.push({
      startPos: start,
      endPos: end,
      type: "horizontalRule",
    });

    this.addScope(scopes, start, end, "horizontalRule");
  }

  /**
   * Processes a text node to extract emoji shortcodes.
   */
  private processText(
    node: Text,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't parse emoji shortcodes inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const start = node.position!.start.offset!;
    this.processEmojiShortcodesInSlice(node.value, start, decorations, scopes);
  }

  /**
   * Detects and decorates emoji shortcodes in a text slice.
   *
   * Matches GitHub-style emoji shortcodes (e.g., `:smile:`, `:+1:`, `:t-rex:`).
   * Shortcodes must:
   * - Start and end with `:`
   * - Contain only alphanumeric characters, underscores, hyphens, and plus signs
   * - Be case-insensitive (matched against lowercase keys in emoji map)
   *
   * The regex pattern `/:([a-z0-9_+-]+):/gi` matches valid shortcode patterns.
   * Since this processes text nodes from the parsed AST (not raw markdown),
   * URLs and other markdown syntax are already handled by their respective nodes,
   * reducing false positives. However, the pattern is still defensive and only
   * matches when a valid emoji exists in the emoji map.
   *
   * The emoji map is lazily loaded only when colons are found in the text,
   * improving initial load time for documents without emojis.
   *
   * @param slice - The text slice to search for emoji shortcodes
   * @param offset - Character offset of the slice within the original document
   * @param decorations - Array to accumulate decoration ranges
   * @param scopes - Array to accumulate scope ranges
   */
  private processEmojiShortcodesInSlice(
    slice: string,
    offset: number,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
  ): void {
    if (!slice || slice.indexOf(":") === -1) {
      return;
    }

    // Lazy load emoji map only when we encounter a colon (potential emoji)
    const emojiByShortcode = getEmojiMap();

    // Match GitHub-style emoji shortcodes: :shortcode:
    // Pattern allows: letters, numbers, underscores, hyphens, plus signs
    // Examples: :smile:, :+1:, :-1:, :t-rex:, :non-potable_water:
    // The 'g' flag ensures we find all matches, 'i' makes it case-insensitive
    const regex = /:([a-z0-9_+-]+):/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(slice)) !== null) {
      const rawName = match[1];
      // Normalize to lowercase for case-insensitive lookup
      const name = rawName.toLowerCase();
      const emoji = emojiByShortcode[name];
      if (!emoji) {
        // Invalid shortcode (not in emoji map) - silently ignore
        continue;
      }

      const start = offset + match.index;
      const end = start + match[0].length;
      decorations.push({
        startPos: start,
        endPos: end,
        type: "emoji",
        emoji,
      });
      this.addScope(scopes, start, end, "emoji");
    }
  }

  /**
   * Handles empty image alt text that remark doesn't parse as an Image node.
   * Optimized with early exit to avoid regex when no image syntax exists.
   */
  private handleEmptyImageAlt(
    text: string,
    decorations: DecorationRange[],
  ): void {
    // Early exit: check if '![' exists in text before running regex
    if (text.indexOf("![") === -1) {
      return;
    }

    // Find ![] patterns that weren't handled by processImage
    const regex = /!\[\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const pos = match.index;
      // Check if this position is already covered by a decoration
      const isCovered = decorations.some(
        (d) => d.startPos <= pos && d.endPos > pos,
      );
      if (!isCovered) {
        // Add hide decorations for ![
        decorations.push({
          startPos: pos,
          endPos: pos + 2,
          type: "hide",
        });
        // Add hide decoration for ]
        decorations.push({
          startPos: pos + 2,
          endPos: pos + 3,
          type: "hide",
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
      if (char1 === 0x2a && char2 === 0x2a) {
        return "**";
      }

      // Check for '__' (underscore = 0x5F)
      if (char1 === 0x5f && char2 === 0x5f) {
        return "__";
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
      if (charCode === 0x2a) {
        return "*";
      }

      // Check for '_' (underscore = 0x5F)
      if (charCode === 0x5f) {
        return "_";
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
  private processFrontmatter(
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
  ): void {
    if (!text || text.length < MarkdownParser.MIN_FRONTMATTER_LENGTH) {
      return;
    }

    // Find the start of the document (skip leading spaces/tabs only, not newlines)
    // This ensures frontmatter is truly at document start, not after content
    let startPos = 0;
    while (
      startPos < text.length &&
      (text[startPos] === " " || text[startPos] === "\t")
    ) {
      startPos++;
    }

    // Check if document starts with ---
    if (
      startPos + MarkdownParser.MIN_FRONTMATTER_LENGTH > text.length ||
      text.substring(
        startPos,
        startPos + MarkdownParser.MIN_FRONTMATTER_LENGTH,
      ) !== "---"
    ) {
      return;
    }

    // Find the end of the opening delimiter line
    const openingDelimiterStart = startPos;
    const openingLineEnd = text.indexOf("\n", openingDelimiterStart);
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
    while (
      searchPos < text.length &&
      linesSearched < MarkdownParser.MAX_FRONTMATTER_SEARCH_LINES
    ) {
      // Find next line start
      const lineStart = searchPos;
      let lineStartPos = lineStart;

      // Skip whitespace at line start
      while (lineStartPos < text.length && /\s/.test(text[lineStartPos])) {
        lineStartPos++;
      }

      // Check if this line starts with ---
      if (
        lineStartPos + MarkdownParser.MIN_FRONTMATTER_LENGTH <= text.length &&
        text.substring(
          lineStartPos,
          lineStartPos + MarkdownParser.MIN_FRONTMATTER_LENGTH,
        ) === "---"
      ) {
        // Found potential closing delimiter - validate the entire line
        const closingDelimiterStart = lineStartPos;
        const closingLineEnd = text.indexOf("\n", closingDelimiterStart);
        const lineEnd = closingLineEnd === -1 ? text.length : closingLineEnd;
        const lineContent = text.substring(lineStartPos, lineEnd);

        // Validate: closing delimiter line must contain only --- with optional whitespace
        // This prevents false matches like "--- some text" or "---comment"
        if (!/^---\s*$/.test(lineContent)) {
          // Not a valid closing delimiter, continue searching
          const nextLine =
            closingLineEnd === -1 ? text.length : closingLineEnd + 1;
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
          const closingLineEndPos =
            closingLineEnd === -1
              ? closingDelimiterStart + MarkdownParser.MIN_FRONTMATTER_LENGTH // End at end of --- (no newline, end of document)
              : closingLineEnd; // End at newline position (exclusive, so newline is not included)

          // Apply background decoration to entire block from opening delimiter start to end of closing delimiter line
          decorations.push({
            startPos: openingDelimiterStart,
            endPos: closingLineEndPos,
            type: "frontmatter",
          });

          this.addScope(
            scopes,
            openingDelimiterStart,
            closingLineEndPos,
            "frontmatter",
          );

          // Apply opacity decoration to opening delimiter (---)
          // The delimiter is exactly 3 characters: ---
          const openingDelimiterEnd =
            openingDelimiterStart + MarkdownParser.MIN_FRONTMATTER_LENGTH;
          decorations.push({
            startPos: openingDelimiterStart,
            endPos: openingDelimiterEnd,
            type: "frontmatterDelimiter",
          });

          // Apply opacity decoration to closing delimiter (---)
          // The delimiter is exactly 3 characters: ---
          const closingDelimiterEnd =
            closingDelimiterStart + MarkdownParser.MIN_FRONTMATTER_LENGTH;
          decorations.push({
            startPos: closingDelimiterStart,
            endPos: closingDelimiterEnd,
            type: "frontmatterDelimiter",
          });
        }
        return;
      }

      // Move to next line
      const nextLine = text.indexOf("\n", searchPos);
      if (nextLine === -1) {
        break;
      }
      searchPos = nextLine + 1;
      linesSearched++;
    }

    // No closing delimiter found - not valid frontmatter, don't apply decoration
  }

  /**
   * Extracts plain display text from a TableCell AST node by walking its
   * child tree. Avoids regex-based stripping which incorrectly removes
   * literal underscores and asterisks (e.g. snake_case, 100*200).
   */
  private extractCellPlainText(cell: TableCell): string {
    const walk = (node: Node): string => {
      switch (node.type) {
        case "text":
          return (node as Text).value;
        case "inlineCode":
          return (node as InlineCode).value;
        case "strong":
        case "emphasis":
        case "delete": {
          const parent = node as Strong | Emphasis | Delete;
          return parent.children.map(walk).join("");
        }
        default: {
          const asParent = node as { children?: Node[] };
          if (asParent.children) {
            return asParent.children.map(walk).join("");
          }
          return "";
        }
      }
    };
    return cell.children.map(walk).join("");
  }

  /**
   * Returns true if a cell has inline formatting children (strong, emphasis,
   * delete, inlineCode) that cannot be rendered as whole-cell CSS.
   * Used to decide whether to show raw syntax vs AST-extracted plain text.
   */
  private cellHasMixedFormatting(cell: TableCell): boolean {
    return cell.children.some(child =>
      child.type === "strong" || child.type === "emphasis" ||
      child.type === "delete" || child.type === "inlineCode"
    );
  }

  /**
   * Detects whole-cell formatting and returns CSS properties for the before
   * pseudo-element. Returns undefined for unformatted or mixed-format cells.
   *
   * When undefined is returned and the cell contains formatting markers,
   * the caller falls back to showing the raw cell text (VS Code cannot
   * partially style a single contentText string).
   */
  private detectCellStyle(
    trimmed: string,
  ): { fontWeight?: string; fontStyle?: string; textDecoration?: string } | undefined {
    // Order matters: check longer markers first to avoid partial matches
    // Bold-italic: ***text*** or ___text___
    if (
      (trimmed.startsWith("***") && trimmed.endsWith("***")) ||
      (trimmed.startsWith("___") && trimmed.endsWith("___"))
    ) {
      return { fontWeight: "bold", fontStyle: "italic" };
    }
    // Bold: **text** or __text__
    if (
      (trimmed.startsWith("**") && trimmed.endsWith("**")) ||
      (trimmed.startsWith("__") && trimmed.endsWith("__"))
    ) {
      return { fontWeight: "bold" };
    }
    // Strikethrough: ~~text~~
    if (trimmed.startsWith("~~") && trimmed.endsWith("~~")) {
      return { textDecoration: "line-through" };
    }
    // Italic: *text* or _text_
    if (
      (trimmed.startsWith("*") && trimmed.endsWith("*") && trimmed.length > 2) ||
      (trimmed.startsWith("_") && trimmed.endsWith("_") && trimmed.length > 2)
    ) {
      return { fontStyle: "italic" };
    }
    // Inline code: `text`
    if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length > 2) {
      return { fontWeight: "normal" };
    }
    return undefined;
  }

  /**
   * Measures display width for monospace column alignment of **plain** cell text
   * (no markdown markers — callers use `extractCellPlainText` / `detectCellStyle` paths).
   *
   * CJK wide characters (Unicode ranges U+2E80–U+9FFF, U+F900–U+FAFF,
   * U+FE30–U+FE4F, U+20000–U+2FA1F) count as 2 columns; all others as 1.
   *
   * Adds a small per-CJK-character correction because VS Code's `before`
   * pseudo-element renders CJK glyphs slightly wider than exactly 2x
   * ASCII width in most monospace fonts.
   *
   * @param plain - Already-unmarked cell display text
   * @returns Estimated width in monospace columns
   */
  private measureTextWidth(plain: string): number {
    let width = 0;
    let cjkCount = 0;
    for (const char of plain) {
      const code = char.codePointAt(0)!;
      if (
        (code >= 0x2e80 && code <= 0x9fff) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe30 && code <= 0xfe4f) ||
        (code >= 0x20000 && code <= 0x2fa1f)
      ) {
        width += 2;
        cjkCount++;
      } else {
        width += 1;
      }
    }
    // Correction: VS Code's before pseudo-element renders CJK glyphs
    // slightly wider than exactly 2x ASCII in most default fonts.
    // ceil(n*0.25) ensures every CJK cell gets at least +1 correction.
    return width + Math.ceil(cjkCount * 0.25);
  }

  /**
   * Finds unescaped pipe positions within a line range.
   * Counts consecutive preceding backslashes: pipe is escaped only when
   * the count is odd (e.g. \| is escaped, \\| is not).
   */
  private findPipePositions(
    text: string,
    lineStart: number,
    lineEnd: number,
  ): number[] {
    const pipes: number[] = [];
    for (let i = lineStart; i < lineEnd; i++) {
      if (text[i] === "|") {
        let backslashCount = 0;
        let j = i - 1;
        while (j >= lineStart && text[j] === "\\") {
          backslashCount++;
          j--;
        }
        if (backslashCount % 2 === 0) {
          pipes.push(i);
        }
      }
    }
    return pipes;
  }

  /**
   * Augments pipe positions with virtual boundary markers for rows that lack
   * leading and/or trailing pipe characters. Virtual positions enable cell
   * boundary detection but should NOT generate tablePipe decorations.
   */
  private normalizePipePositions(
    text: string,
    lineStart: number,
    trimmedLineEnd: number,
    pipes: number[],
  ): { positions: number[]; isVirtual: boolean[] } {
    if (pipes.length === 0) {
      return { positions: pipes, isVirtual: [] };
    }

    const positions = [...pipes];
    const isVirtual: boolean[] = new Array(pipes.length).fill(false);

    // Find first non-whitespace position on this line
    let firstContentPos = lineStart;
    while (firstContentPos < trimmedLineEnd && (text[firstContentPos] === " " || text[firstContentPos] === "\t")) {
      firstContentPos++;
    }

    // Inject virtual leading boundary if first pipe is not the first content char.
    // When the line starts with content at `lineStart`, `firstContentPos - 1` would be
    // invalid (-1); use -1 as a sentinel so cell ranges use substring(pipes[i] + 1, …) → start at 0.
    if (pipes[0] !== firstContentPos) {
      const virtualLead =
        firstContentPos > lineStart ? firstContentPos - 1 : -1;
      positions.unshift(virtualLead);
      isVirtual.unshift(true);
    }

    // Inject virtual trailing boundary if last pipe is not at the line end
    if (pipes[pipes.length - 1] < trimmedLineEnd - 1) {
      positions.push(trimmedLineEnd);
      isVirtual.push(true);
    }

    return { positions, isVirtual };
  }

  /**
   * Gets the line boundaries (start offset, end offset excluding newline) for a
   * given character offset within the source text.
   */
  private getLineRange(text: string, offset: number): [number, number] {
    const lineStart =
      offset === 0 ? 0 : text.lastIndexOf("\n", offset - 1) + 1;
    let lineEnd = text.indexOf("\n", offset);
    if (lineEnd === -1) lineEnd = text.length;
    return [lineStart, lineEnd];
  }

  /**
   * Trims trailing whitespace from a line range, returning the new end offset.
   */
  private trimLineEnd(
    text: string,
    lineStart: number,
    lineEnd: number,
  ): number {
    let end = lineEnd;
    while (
      end > lineStart &&
      (text[end - 1] === " " || text[end - 1] === "\t")
    ) {
      end--;
    }
    return end;
  }

  /**
   * Computes the maximum display width for each column in a table.
   *
   * Uses pipe positions on each row line to extract cell content, avoiding
   * remark-gfm cell positions which include pipe characters.
   *
   * @param tableNode - The remark Table AST node
   * @param source - The full normalized document text
   * @returns Array of column widths (one per column, minimum 3)
   */
  private computeColumnWidths(tableNode: Table, source: string): number[] {
    let numCols = 0;

    for (const row of tableNode.children) {
      if (!row.position || row.position.start.offset === undefined) continue;
      const [lineStart, lineEnd] = this.getLineRange(
        source,
        row.position.start.offset,
      );
      const trimmed = this.trimLineEnd(source, lineStart, lineEnd);
      const rawPipes = this.findPipePositions(source, lineStart, trimmed);
      const { positions: pipes } = this.normalizePipePositions(source, lineStart, trimmed, rawPipes);
      const cellCount = Math.max(0, pipes.length - 1);
      if (cellCount > numCols) numCols = cellCount;
    }

    const widths: number[] = new Array(numCols).fill(3);

    for (const row of tableNode.children) {
      if (!row.position || row.position.start.offset === undefined) continue;
      const [lineStart, lineEnd] = this.getLineRange(
        source,
        row.position.start.offset,
      );
      const trimmed = this.trimLineEnd(source, lineStart, lineEnd);
      const rawPipes = this.findPipePositions(source, lineStart, trimmed);
      const { positions: pipes } = this.normalizePipePositions(source, lineStart, trimmed, rawPipes);

      for (let i = 0; i < pipes.length - 1 && i < numCols; i++) {
        const cellText = source.substring(pipes[i] + 1, pipes[i + 1]).trim();
        const astCell = i < row.children.length ? row.children[i] as TableCell : undefined;
        const cellStyle = this.detectCellStyle(cellText);
        // Mixed formatting → raw syntax; otherwise → AST plain text (handles escapes)
        const showRaw = !cellStyle && astCell && this.cellHasMixedFormatting(astCell);
        const displayText = (astCell && !showRaw)
          ? this.extractCellPlainText(astCell)
          : cellText;
        const w = this.measureTextWidth(displayText);
        if (w > widths[i]) widths[i] = w;
      }
    }

    return widths;
  }

  /**
   * Processes a GFM table node and emits decorations for pipes, cells, and the separator row.
   *
   * Produces:
   * - `tablePipe` decorations for `|` in header and data rows (replaced with `│`)
   * - `tableSeparatorPipe` decorations for `|` in the separator row (replaced with `├`, `┼`, or `┤`)
   * - `tableSeparatorDash` decorations for dash segments in the separator row (replaced with `─` repeats)
   * - `tableCell` decorations for cell content (padded to uniform column width)
   *
   * Also adds a scope for the entire table so the visibility model can reveal the
   * whole block when the cursor is inside it.
   */
  private processTable(
    node: Table,
    text: string,
    decorations: DecorationRange[],
    scopes: ScopeRange[],
    ancestors: Node[],
  ): void {
    if (!this.hasValidPosition(node)) return;

    // Don't process tables inside code blocks
    if (this.isInCodeBlock(ancestors)) {
      return;
    }

    const tableStart = node.position!.start.offset!;
    const tableEnd = node.position!.end.offset!;
    const colWidths = this.computeColumnWidths(node, text);
    const colAligns = node.align ?? [];

    this.addScope(scopes, tableStart, tableEnd, "table");

    for (let rowIdx = 0; rowIdx < node.children.length; rowIdx++) {
      const row = node.children[rowIdx];
      if (
        !row.position ||
        row.position.start.offset === undefined ||
        row.position.end.offset === undefined
      ) {
        continue;
      }

      const rowStartOffset = row.position.start.offset;
      const [lineStart, lineEnd] = this.getLineRange(text, rowStartOffset);
      const trimmedLineEnd = this.trimLineEnd(text, lineStart, lineEnd);
      const rawPipes = this.findPipePositions(text, lineStart, trimmedLineEnd);
      const { positions: pipes, isVirtual } = this.normalizePipePositions(
        text, lineStart, trimmedLineEnd, rawPipes,
      );

      // Only decorate real (non-virtual) pipes
      for (let pIdx = 0; pIdx < pipes.length; pIdx++) {
        if (!isVirtual[pIdx]) {
          decorations.push({
            startPos: pipes[pIdx],
            endPos: pipes[pIdx] + 1,
            type: "tablePipe",
            replacement: "\u2502", // │
          });
        }
      }

      // Derive cells from pipe positions (avoids remark cell positions which include pipes)
      for (let i = 0; i < pipes.length - 1; i++) {
        const cellRangeStart = pipes[i] + 1;
        const cellRangeEnd = pipes[i + 1];
        if (cellRangeStart >= cellRangeEnd) continue;

        const rawContent = text.substring(cellRangeStart, cellRangeEnd);
        const trimmedContent = rawContent.trim();
        const cellStyle = this.detectCellStyle(trimmedContent);
        const colWidth = i < colWidths.length ? colWidths[i] : 3;

        // Whole-cell styled: extract clean text via AST + apply CSS
        // Mixed formatting: show raw syntax (VS Code can't partially style)
        // Plain / escaped: use AST extraction (handles \| → |, \\ → \)
        const astCell = i < row.children.length ? row.children[i] as TableCell : undefined;
        const showRaw = !cellStyle && astCell && this.cellHasMixedFormatting(astCell);
        const displayContent = (astCell && !showRaw)
          ? this.extractCellPlainText(astCell)
          : trimmedContent;
        const displayWidth = this.measureTextWidth(displayContent);
        const totalPad = Math.max(0, colWidth - displayWidth);
        const align = i < colAligns.length ? colAligns[i] : null;

        let replacement: string;
        if (align === "right") {
          replacement = "\u00A0".repeat(totalPad + 1) + displayContent + "\u00A0";
        } else if (align === "center") {
          const padLeft = Math.floor(totalPad / 2);
          const padRight = totalPad - padLeft;
          replacement = "\u00A0".repeat(padLeft + 1) + displayContent + "\u00A0".repeat(padRight + 1);
        } else {
          // left or null (default)
          replacement = "\u00A0" + displayContent + "\u00A0".repeat(totalPad + 1);
        }

        decorations.push({
          startPos: cellRangeStart,
          endPos: cellRangeEnd,
          type: "tableCell",
          replacement,
          cellStyle,
        });
      }

      // After the header row (index 0), process the separator row.
      // remark-gfm does NOT include the separator row as a child node.
      if (rowIdx === 0) {
        const headerEndOffset = row.position.end.offset;

        let sepLineStart = text.indexOf("\n", headerEndOffset);
        if (sepLineStart === -1) continue;
        sepLineStart += 1;

        let sepLineEnd: number;
        if (node.children.length > 1 && node.children[1].position) {
          const nextRowStart = node.children[1].position.start.offset!;
          sepLineEnd = text.lastIndexOf("\n", nextRowStart - 1);
          if (sepLineEnd === -1 || sepLineEnd < sepLineStart) {
            sepLineEnd = nextRowStart;
          }
        } else {
          sepLineEnd = text.indexOf("\n", sepLineStart);
          if (sepLineEnd === -1) sepLineEnd = tableEnd;
        }

        const trimmedSepEnd = this.trimLineEnd(text, sepLineStart, sepLineEnd);
        const rawSepPipes = this.findPipePositions(text, sepLineStart, trimmedSepEnd);
        const { positions: sepPipes, isVirtual: sepIsVirtual } = this.normalizePipePositions(
          text, sepLineStart, trimmedSepEnd, rawSepPipes,
        );

        // Use │ for separator pipes (same as data rows) and ASCII - for
        // dashes. Box-drawing ─ (U+2500) renders wider than monospace chars
        // in many editor fonts, causing cumulative misalignment.
        for (let pIdx = 0; pIdx < sepPipes.length; pIdx++) {
          if (!sepIsVirtual[pIdx]) {
            decorations.push({
              startPos: sepPipes[pIdx],
              endPos: sepPipes[pIdx] + 1,
              type: "tableSeparatorPipe",
              replacement: "\u2502", // │ (same as regular pipe)
            });
          }
        }

        for (let pIdx = 0; pIdx < sepPipes.length - 1; pIdx++) {
          const segStart = sepPipes[pIdx] + 1;
          const segEnd = sepPipes[pIdx + 1];
          if (segStart >= segEnd) continue;

          const colWidth = pIdx < colWidths.length ? colWidths[pIdx] : 3;
          decorations.push({
            startPos: segStart,
            endPos: segEnd,
            type: "tableSeparatorDash",
            replacement: "-".repeat(colWidth + 2),
          });
        }
      }
    }
  }
}
