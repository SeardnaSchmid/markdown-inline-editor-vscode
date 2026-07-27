import * as vscode from 'vscode';

const SECTION = 'markdownInlineEditor' as const;

/** Matches `#` + 3, 4, 6, or 8 hex digits (#RGB, #RGBA, #RRGGBB, #RRGGBBAA). Invalid values are treated as unset. */
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

function parseHexColor(value: string | undefined | null): string | undefined {
  if (value === undefined || value === null || typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : undefined;
}

function getColorConfig(key: string): string | undefined {
  return parseHexColor(
    vscode.workspace.getConfiguration(SECTION).get<string>(`colors.${key}`)
  );
}

export const config = {
  diffView: {
    applyDecorations(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('defaultBehaviors.diffView.applyDecorations', false);
    },
  },
  links: {
    singleClickOpen(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('links.singleClickOpen', false);
    },
    /** Chain (🔗) icon after link text; off by default so raw markdown tables stay aligned. */
    showEmoji(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('links.showEmoji', false);
    },
  },
  decorations: {
    ghostFaintOpacity(): number {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<number>('decorations.ghostFaintOpacity', 0.3);
    },
    frontmatterDelimiterOpacity(): number {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<number>('decorations.frontmatterDelimiterOpacity', 0.3);
    },
    codeBlockLanguageOpacity(): number {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<number>('decorations.codeBlockLanguageOpacity', 0.3);
    },
  },
  emojis: {
    enabled(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('emojis.enabled', true);
    },
  },
  math: {
    enabled(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('math.enabled', true);
    },
  },
  orderedLists: {
    /** When true, ordered list markers are hidden and replaced with computed numbers (lazy `1.` numbering, etc.). When false, the source text is shown as written. */
    autoNumber(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('orderedLists.autoNumber', true);
    },
    /** When auto-numbering is on, tint the displayed marker when it differs from the number in the source. */
    warnWhenSourceNumberDiffers(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('orderedLists.warnWhenSourceNumberDiffers', true);
    },
  },
  tables: {
    /**
     * `grid` (the default) keeps the box-drawing look: │ pipes and a dashed separator row.
     * `preview` renders tables like the markdown preview instead: pipes hidden, cells laid
     * out as fixed-width CSS boxes, bold header and horizontal rules.
     */
    style(): 'preview' | 'grid' {
      const value = vscode.workspace
        .getConfiguration(SECTION)
        .get<string>('tables.style', 'grid');
      return value === 'preview' ? 'preview' : 'grid';
    },
    /**
     * Display width of a CJK (full-width) character relative to an ASCII character, used to
     * estimate how wide a column box must be. 2 matches fonts where a full-width glyph is
     * exactly two half-width glyphs.
     */
    cjkWidthRatio(): number {
      const value = vscode.workspace
        .getConfiguration(SECTION)
        .get<number>('tables.cjkWidthRatio', 2);
      if (typeof value !== 'number' || !Number.isFinite(value)) return 2;
      return Math.min(3, Math.max(1, value));
    },
    /** Upper bound for a column box, in character widths. Longer cells are clipped. */
    maxColumnWidth(): number {
      const value = vscode.workspace
        .getConfiguration(SECTION)
        .get<number>('tables.maxColumnWidth', 48);
      if (typeof value !== 'number' || !Number.isFinite(value)) return 48;
      return Math.min(200, Math.max(3, Math.floor(value)));
    },
    /** Draw a thin rule under every data row (preview style only). */
    rowSeparators(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('tables.rowSeparators', true);
    },
  },
  mentions: {
    /** If set, overrides GitHub context: true = force links on, false = force off. Unset = use git remote auto-detect. */
    linksEnabled(): boolean | undefined {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('mentions.linksEnabled');
    },
    /** Optional: master switch to enable/disable mention and issue-reference styling and detection. */
    enabled(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('mentions.enabled', true);
    },
  },
  debug: {
    loggingEnabled(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('debug.logging.enabled', false);
    },
    performanceEnabled(): boolean {
      return vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>('debug.performance.enabled', false);
    },
  },
  colors: {
    heading1(): string | undefined {
      return getColorConfig('heading1');
    },
    heading2(): string | undefined {
      return getColorConfig('heading2');
    },
    heading3(): string | undefined {
      return getColorConfig('heading3');
    },
    heading4(): string | undefined {
      return getColorConfig('heading4');
    },
    heading5(): string | undefined {
      return getColorConfig('heading5');
    },
    heading6(): string | undefined {
      return getColorConfig('heading6');
    },
    link(): string | undefined {
      return getColorConfig('link');
    },
    listMarker(): string | undefined {
      return getColorConfig('listMarker');
    },
    inlineCode(): string | undefined {
      return getColorConfig('inlineCode');
    },
    inlineCodeBackground(): string | undefined {
      return getColorConfig('inlineCodeBackground');
    },
    emphasis(): string | undefined {
      return getColorConfig('emphasis');
    },
    blockquote(): string | undefined {
      return getColorConfig('blockquote');
    },
    image(): string | undefined {
      return getColorConfig('image');
    },
    horizontalRule(): string | undefined {
      return getColorConfig('horizontalRule');
    },
    checkbox(): string | undefined {
      return getColorConfig('checkbox');
    },
  },
} as const;
