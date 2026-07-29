export interface DecorationRange {
  startPos: number;
  endPos: number;
  type: DecorationType;
  url?: string;
  level?: number;
  emoji?: string;
  replacement?: string;
  cellStyle?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
  };
  /**
   * Width of a table cell/separator box, in `ch` units (one `ch` = the advance
   * width of "0" in the editor font).
   *
   * The decorator renders the replacement inside an inline-block of exactly
   * this width, so columns line up regardless of how wide the font actually
   * draws the cell's glyphs. This matters because monospace editor fonts
   * (Menlo, Consolas, JetBrains Mono, ...) carry no CJK glyphs and fall back to
   * a system font whose advance is not 2x the ASCII advance — measured at
   * 1.661x for Menlo + PingFang SC, and 1.437x for Korean. Padding with spaces
   * cannot express those ratios; a fixed-width box sidesteps them entirely.
   */
  cellWidth?: number;
  /** How the replacement sits inside its {@link cellWidth} box. */
  cellAlign?: 'left' | 'center' | 'right';
  slug?: string;
  issueNumber?: number;
  ownerRepo?: string;
  orderedListMarkerMismatch?: boolean;
}

export interface ScopeRange {
  startPos: number;
  endPos: number;
  kind?: string;
}

export interface MermaidBlock {
  startPos: number;
  endPos: number;
  source: string;
  numLines: number;
}

export interface MathRegion {
  startPos: number;
  endPos: number;
  source: string;
  displayMode: boolean;
  numLines?: number;
}

export interface ParseResult {
  decorations: DecorationRange[];
  scopes: ScopeRange[];
  mermaidBlocks: MermaidBlock[];
  mathRegions: MathRegion[];
}

export type DecorationType =
  | "hide"
  | "transparent"
  | "selectionOverlay"
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
