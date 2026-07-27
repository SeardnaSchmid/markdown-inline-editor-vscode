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
  slug?: string;
  issueNumber?: number;
  ownerRepo?: string;
  orderedListMarkerMismatch?: boolean;
  /** Preview-style tables: width of the cell (or rule) box, in character widths. */
  boxWidth?: number;
  /** Preview-style tables: horizontal alignment of the cell content. */
  cellAlign?: "left" | "center" | "right";
  /** Preview-style tables: the cell belongs to the header row and is rendered bold. */
  isHeaderCell?: boolean;
  /** Preview-style tables: draw a thin rule along the bottom edge of the cell box. */
  drawRowSeparator?: boolean;
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
  | "tableRule"
  | "tableCell"
  | "mention"
  | "issueReference";
