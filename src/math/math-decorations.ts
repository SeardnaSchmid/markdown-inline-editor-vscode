import { type TextEditor, window, Uri, type Range, ColorThemeKind, workspace } from 'vscode';
import type { MathRegion } from '../parser';
import { renderMathToDataUri } from './math-renderer';

/** Default editor foreground colors by theme (VS Code defaults). */
const DEFAULT_FOREGROUND = {
  dark: '#d4d4d4',
  light: '#3c3c3c',
} as const;

/** Compute line height from editor settings, aligned with mermaid sizing fallback. */
function getEditorHeights(): { blockHeight: number; inlineHeight: number; lineHeight: number } {
  const editorConfig = workspace.getConfiguration('editor');
  const fontSize = editorConfig.get<number>('fontSize', 14);
  const lineHeightSetting = editorConfig.get<number>('lineHeight', 0);
  let lineHeight: number;
  if (lineHeightSetting === 0 || lineHeightSetting < 8) {
    const multiplier = process.platform === 'darwin' ? 1.5 : 1.35;
    lineHeight = Math.round(fontSize * multiplier);
    if (lineHeight < 8) {
      lineHeight = 8;
    }
  } else if (lineHeightSetting >= 10) {
    lineHeight = Math.round(lineHeightSetting);
  } else {
    lineHeight = Math.round(fontSize * lineHeightSetting);
  }
  const inlineHeight = Math.round(fontSize * 1.2);
  return { blockHeight: lineHeight, inlineHeight, lineHeight };
}

type MathDecorationEntry = {
  decorationType: ReturnType<typeof window.createTextEditorDecorationType>;
  lastUsed: number;
  isDarkTheme: boolean;
};

/** Creates content key for caching decoration type (source + displayMode + optional numLines for height). */
function contentKey(source: string, displayMode: boolean, numLines?: number): string {
  if (displayMode && numLines !== undefined && numLines !== null) {
    return `block:${numLines}:${source}`;
  }
  return `${displayMode ? 'block' : 'inline'}:${source}`;
}

export class MathDecorations {
  private cache = new Map<string, MathDecorationEntry>();
  private usageCounter = 0;

  constructor(private maxEntries: number = 100) {}

  /**
   * Apply math decorations for the given regions. Renders LaTeX to data URIs,
   * caches decoration types by content key, and applies to editor ranges.
   * Regions whose range is null (e.g. selection intersects) are skipped.
   */
  apply(
    editor: TextEditor,
    regionsWithRanges: Array<{ region: MathRegion; range: Range | null }>
  ): void {
    const usedKeys = new Set<string>();
    const isDarkTheme =
      window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast;

    const foregroundColor = DEFAULT_FOREGROUND[isDarkTheme ? 'dark' : 'light'];
    const { blockHeight, inlineHeight, lineHeight } = getEditorHeights();

    const byKey = new Map<string, { ranges: Range[]; dataUri: string }>();
    for (const { region, range } of regionsWithRanges) {
      if (!range) continue;
      const height =
        region.displayMode && region.numLines !== undefined && region.numLines !== null
          ? (region.numLines + 2) * lineHeight
          : region.displayMode
            ? blockHeight
            : inlineHeight;
      const dataUri = renderMathToDataUri(region.source, {
        displayMode: region.displayMode,
        height,
        foregroundColor,
      });
      if (!dataUri) continue;
      const key = contentKey(region.source, region.displayMode, region.numLines);
      const existing = byKey.get(key);
      if (existing) {
        existing.ranges.push(range);
      } else {
        byKey.set(key, { ranges: [range], dataUri });
      }
    }

    for (const [key, { ranges, dataUri }] of byKey.entries()) {
      const entry = this.getOrCreateEntry(key, dataUri, isDarkTheme);
      usedKeys.add(key);
      editor.setDecorations(entry.decorationType, ranges);
    }

    this.disposeUnused(editor, usedKeys);
  }

  clear(editor: TextEditor): void {
    for (const entry of this.cache.values()) {
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
    }
    this.cache.clear();
  }

  private getOrCreateEntry(
    key: string,
    dataUri: string,
    isDarkTheme: boolean
  ): MathDecorationEntry {
    const existing = this.cache.get(key);
    if (existing && existing.isDarkTheme === isDarkTheme) {
      existing.lastUsed = ++this.usageCounter;
      return existing;
    }
    if (existing) {
      existing.decorationType.dispose();
      this.cache.delete(key);
    }
    const displayMode = key.startsWith('block:');
    const decorationType = window.createTextEditorDecorationType({
      color: 'transparent',
      textDecoration: 'none; display: inline-block; width: 0;',
      before: {
        contentIconPath: Uri.parse(dataUri),
        textDecoration: 'none;',
      },
      ...(displayMode
        ? { rangeBehavior: 1 as const /* TrackedRangeStickiness.NeverGrowWhenTypingAtEdges */ }
        : {}),
    });
    const entry: MathDecorationEntry = {
      decorationType,
      lastUsed: ++this.usageCounter,
      isDarkTheme,
    };
    this.cache.set(key, entry);
    this.evictIfNeeded();
    return entry;
  }

  private disposeUnused(editor: TextEditor, usedKeys: Set<string>): void {
    for (const [key, entry] of this.cache.entries()) {
      if (usedKeys.has(key)) continue;
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
      this.cache.delete(key);
    }
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxEntries) return;
    let lruKey: string | undefined;
    let lruAccess = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed < lruAccess) {
        lruAccess = entry.lastUsed;
        lruKey = key;
      }
    }
    if (lruKey) {
      this.cache.get(lruKey)?.decorationType.dispose();
      this.cache.delete(lruKey);
    }
  }
}
