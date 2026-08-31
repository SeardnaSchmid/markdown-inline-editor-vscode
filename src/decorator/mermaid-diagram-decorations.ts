import { type TextEditor, window, Uri, type TextEditorDecorationType, type Range, ColorThemeKind } from 'vscode';
import { getEditorLineHeight } from '../editor-metrics';

type MermaidDecorationEntry = {
  decorationType: TextEditorDecorationType;
  lastUsed: number;
  isDarkTheme: boolean;
};

export class MermaidDiagramDecorations {
  private cache = new Map<string, MermaidDecorationEntry>();
  private usageCounter = 0;

  constructor(private maxEntries: number = 50) {}

  /**
   * Applies diagram decorations, one decoration type per rendered SVG.
   *
   * @param lineOffsetsByKey - Lines each diagram was re-anchored down by, pulled
   *   back up with a negative margin so the diagram keeps its place while the
   *   top of its block is scrolled out of view. Absent means no offset.
   */
  apply(
    editor: TextEditor,
    rangesByKey: Map<string, Range[]>,
    dataUrisByKey: Map<string, string>,
    lineOffsetsByKey?: Map<string, number>
  ): void {
    const usedKeys = new Set<string>();
    const isDarkTheme = window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast;

    for (const [key, ranges] of rangesByKey.entries()) {
      const dataUri = dataUrisByKey.get(key);
      if (!dataUri || ranges.length === 0) {
        continue;
      }
      const entry = this.getOrCreateEntry(key, dataUri, isDarkTheme, lineOffsetsByKey?.get(key) ?? 0);
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
    isDarkTheme: boolean,
    lineOffset: number
  ): MermaidDecorationEntry {
    const existing = this.cache.get(key);
    // Invalidate cache if theme changed
    if (existing && existing.isDarkTheme === isDarkTheme) {
      existing.lastUsed = ++this.usageCounter;
      return existing;
    }

    // Dispose old entry if theme changed
    if (existing) {
      existing.decorationType.dispose();
      this.cache.delete(key);
    }

    // Re-anchored diagrams hang off a lower line, so shift them back up by the
    // rows they skipped. The overflow is clipped by the viewport, which is
    // exactly the part that scrolled away.
    const margin = lineOffset > 0
      ? `-${lineOffset * getEditorLineHeight()}px 0 0 0`
      : undefined;

    // Mermaid themes handle colors internally, so we don't need to invert.
    // Only the image lives here; the block's source is collapsed separately by
    // MermaidSourceDecorationType.
    const decorationType = window.createTextEditorDecorationType({
      before: {
        contentIconPath: Uri.parse(dataUri),
        textDecoration: 'none;',
        margin,
      },
    });

    const entry: MermaidDecorationEntry = {
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
      if (usedKeys.has(key)) {
        continue;
      }
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
      this.cache.delete(key);
    }
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxEntries) {
      return;
    }

    let lruKey: string | undefined;
    let lruAccess = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed < lruAccess) {
        lruAccess = entry.lastUsed;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = this.cache.get(lruKey);
      entry?.decorationType.dispose();
      this.cache.delete(lruKey);
    }
  }
}
