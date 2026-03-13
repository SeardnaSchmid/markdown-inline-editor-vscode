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
