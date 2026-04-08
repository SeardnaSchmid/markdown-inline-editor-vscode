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
import {
  addMarkerDecorations as addMarkerDecorationsHelper,
  addScope as addScopeHelper,
  dedupeScopes as dedupeScopesHelper,
  getBoldMarker as getBoldMarkerHelper,
  getItalicMarker as getItalicMarkerHelper,
  hasValidPosition as hasValidPositionHelper,
  isInCodeBlock as isInCodeBlockHelper,
} from "./common";
import {
  processFrontmatter as processFrontmatterHelper,
} from "./frontmatter";
import {
  filterDecorationsInCodeBlocks as filterDecorationsInCodeBlocksHelper,
  scanMentionAndIssueRefs as scanMentionAndIssueRefsHelper,
} from "./mentions";
import {
  cellHasMixedFormatting as cellHasMixedFormattingHelper,
  computeColumnWidths as computeColumnWidthsHelper,
  detectCellStyle as detectCellStyleHelper,
  extractCellPlainText as extractCellPlainTextHelper,
  findPipePositions as findPipePositionsHelper,
  getLineRange as getLineRangeHelper,
  measureTextWidth as measureTextWidthHelper,
  normalizePipePositions as normalizePipePositionsHelper,
  trimLineEnd as trimLineEndHelper,
} from "./tables";
import {
  processEmphasis as processEmphasisHelper,
  processHeading as processHeadingHelper,
  processInlineCode as processInlineCodeHelper,
  processStrikethrough as processStrikethroughHelper,
  processStrong as processStrongHelper,
} from "./inline-formatting";
import { processCodeBlock as processCodeBlockHelper } from "./code-blocks";
import {
  processBlockquote as processBlockquoteHelper,
  processListItem as processListItemHelper,
  processThematicBreak as processThematicBreakHelper,
} from "./list-quote";
import {
  handleEmptyImageAlt as handleEmptyImageAltHelper,
  processEmojiShortcodesInSlice as processEmojiShortcodesInSliceHelper,
  processTextNode as processTextNodeHelper,
} from "./text-processing";
import { getRemarkProcessorSync, getRemarkProcessor } from "../parser-remark";
import { getEmojiMap } from "../emoji-map-loader";
import { scanMathRegions } from "../math/math-scanner";
import { config } from "../config";
import { logError, logWarn } from "../logging";
import { normalizeToLF } from "../position-mapping";
import {
  DecorationRange,
  DecorationType,
  MermaidBlock,
  ParseResult,
  ScopeRange,
} from "./types";

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
    const normalizedText = normalizeToLF(text);

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
      logError('Error parsing markdown', error);
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
          logWarn('Error processing AST node', error, { nodeType: node.type });
        }
      },
    );
  }

  /**
   * Validates that a node has valid position information.
   * @returns {boolean} True if node position is valid
   */
  private hasValidPosition(node: Node): boolean {
    return hasValidPositionHelper(node);
  }

  /**
   * Checks if any ancestor node is a code block (fenced or inline).
   * Used to skip processing markdown formatting inside code blocks.
   *
   * @param ancestors - Array of ancestor nodes to check
   * @returns {boolean} True if any ancestor is a code block
   */
  private isInCodeBlock(ancestors: Node[]): boolean {
    return isInCodeBlockHelper(ancestors);
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
    addMarkerDecorationsHelper(decorations, start, end, markerLength, contentType);
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
    addScopeHelper(scopes, startPos, endPos, kind);
  }

  /**
   * Deduplicates and sorts scopes by start position.
   */
  private dedupeScopes(scopes: ScopeRange[]): ScopeRange[] {
    return dedupeScopesHelper(scopes);
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
    scanMentionAndIssueRefsHelper(text, decorations, scopes);
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
    filterDecorationsInCodeBlocksHelper(decorations, scopes, text);
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
    processHeadingHelper(node, text, decorations, scopes, ancestors);
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
    processStrongHelper(node, text, decorations, scopes, ancestors);
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
    processEmphasisHelper(node, text, decorations, scopes, ancestors);
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
    processStrikethroughHelper(node, text, decorations, scopes, ancestors);
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
    processInlineCodeHelper(node, text, decorations, scopes);
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
    processCodeBlockHelper(node, text, decorations, scopes, mermaidBlocks);
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
    processBlockquoteHelper(node, text, decorations, scopes, processedPositions, ancestors);
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
    processListItemHelper(node, text, decorations, scopes, ancestors);
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
    processThematicBreakHelper(node, decorations, scopes, ancestors);
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
    processTextNodeHelper(node, decorations, scopes, ancestors, (slice, offset, outDecorations, outScopes) =>
      this.processEmojiShortcodesInSlice(slice, offset, outDecorations, outScopes)
    );
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
    processEmojiShortcodesInSliceHelper(slice, offset, decorations, scopes, getEmojiMap());
  }

  /**
   * Handles empty image alt text that remark doesn't parse as an Image node.
   * Optimized with early exit to avoid regex when no image syntax exists.
   */
  private handleEmptyImageAlt(
    text: string,
    decorations: DecorationRange[],
  ): void {
    handleEmptyImageAltHelper(text, decorations);
  }

  /**
   * Gets the bold marker type (** or __) from source text.
   * Optimized to use character code comparisons instead of substring allocation.
   */
  private getBoldMarker(text: string, pos: number): string | null {
    return getBoldMarkerHelper(text, pos);
  }

  /**
   * Gets the italic marker type (* or _) from source text.
   * Optimized to use character code comparisons instead of string allocation.
   */
  private getItalicMarker(text: string, pos: number): string | null {
    return getItalicMarkerHelper(text, pos);
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
    processFrontmatterHelper(text, decorations, scopes);
  }

  /**
   * Extracts plain display text from a TableCell AST node by walking its
   * child tree. Avoids regex-based stripping which incorrectly removes
   * literal underscores and asterisks (e.g. snake_case, 100*200).
   */
  private extractCellPlainText(cell: TableCell): string {
    return extractCellPlainTextHelper(cell);
  }

  /**
   * Returns true if a cell has inline formatting children (strong, emphasis,
   * delete, inlineCode) that cannot be rendered as whole-cell CSS.
   * Used to decide whether to show raw syntax vs AST-extracted plain text.
   */
  private cellHasMixedFormatting(cell: TableCell): boolean {
    return cellHasMixedFormattingHelper(cell);
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
    return detectCellStyleHelper(trimmed);
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
    return measureTextWidthHelper(plain);
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
    return findPipePositionsHelper(text, lineStart, lineEnd);
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
    return normalizePipePositionsHelper(text, lineStart, trimmedLineEnd, pipes);
  }

  /**
   * Gets the line boundaries (start offset, end offset excluding newline) for a
   * given character offset within the source text.
   */
  private getLineRange(text: string, offset: number): [number, number] {
    return getLineRangeHelper(text, offset);
  }

  /**
   * Trims trailing whitespace from a line range, returning the new end offset.
   */
  private trimLineEnd(
    text: string,
    lineStart: number,
    lineEnd: number,
  ): number {
    return trimLineEndHelper(text, lineStart, lineEnd);
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
    return computeColumnWidthsHelper(tableNode, source);
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
