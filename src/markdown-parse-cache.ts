import type * as vscode from 'vscode';
import type { DecorationRange, ScopeRange, MermaidBlock, MathRegion, MarkdownParser } from './parser';
import { mapNormalizedToOriginal } from './position-mapping';
import { logDebug, logPerformanceMetric } from './logging';

function mapOriginalToNormalized(originalOffset: number, originalText: string): number {
  if (!originalText.includes('\r')) {
    return originalOffset;
  }
  let crCount = 0;
  const limit = Math.min(originalOffset, originalText.length);
  for (let i = 0; i < limit; i++) {
    if (originalText.charCodeAt(i) === 13 && i + 1 < originalText.length && originalText.charCodeAt(i + 1) === 10) {
      crCount++;
    }
  }
  return originalOffset - crCount;
}

function spliceAndShift<T extends { startPos: number; endPos: number }>(
  existing: readonly T[],
  inserted: readonly T[],
  sliceStart: number,
  sliceEnd: number,
  delta: number,
  sort = false
): T[] {
  const out: T[] = [];
  for (const item of existing) {
    if (item.endPos <= sliceStart) {
      out.push(item);
    } else if (item.startPos >= sliceEnd) {
      out.push({ ...item, startPos: item.startPos + delta, endPos: item.endPos + delta });
    }
  }
  for (const item of inserted) {
    out.push({ ...item, startPos: item.startPos + sliceStart, endPos: item.endPos + sliceStart });
  }
  if (sort) {
    out.sort((a, b) => a.startPos - b.startPos);
  }
  return out;
}

export type ParseEntry = {
  version: number;
  text: string;
  decorations: DecorationRange[];
  scopes: ScopeRange[];
  mermaidBlocks: MermaidBlock[];
  mathRegions: MathRegion[];
};

type CacheEntry = ParseEntry & {
  lastAccessed: number;
};

export class MarkdownParseCache {
  private cache = new Map<string, CacheEntry>();
  private accessCounter = 0;

  constructor(private parser: MarkdownParser, private maxEntries = 10) {}

  get(document: vscode.TextDocument): ParseEntry {
    const cacheKey = document.uri.toString();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.version === document.version) {
      cached.lastAccessed = ++this.accessCounter;
      logDebug('parse cache hit', { uri: cacheKey, version: document.version });
      return cached;
    }

    const text = document.getText();
    const parseStart = Date.now();
    const { decorations, scopes, mermaidBlocks, mathRegions } = this.parser.extractDecorationsWithScopes(text);
    const parseDurationMs = Date.now() - parseStart;
    const entry: CacheEntry = {
      version: document.version,
      text,
      decorations,
      scopes,
      mermaidBlocks,
      mathRegions,
      lastAccessed: ++this.accessCounter,
    };

    if (this.cache.size >= this.maxEntries && !this.cache.has(cacheKey)) {
      this.evictLRU();
    }

    this.cache.set(cacheKey, entry);
    logPerformanceMetric('parse-cache.get', {
      uri: cacheKey,
      version: document.version,
      parseMs: parseDurationMs,
      decorations: decorations.length,
      scopes: scopes.length,
      mermaidBlocks: mermaidBlocks.length,
      mathRegions: mathRegions.length,
    });
    return entry;
  }

  /**
   * Attempts an isolated incremental re-parse for a single-line edit inside a cached table.
   * Re-parses only the edited table slice and shifts offsets for items below it.
   * Returns false (leaving cache untouched for full invalidation) on any structural/unsafe edit.
   */
  tryIncrementalTableUpdate(event: vscode.TextDocumentChangeEvent): boolean {
    const document = event.document;
    const cacheKey = document.uri.toString();
    const cached = this.cache.get(cacheKey);
    if (!cached || event.contentChanges.length !== 1) {
      return false;
    }

    const change = event.contentChanges[0];
    if (
      change.range.start.line !== change.range.end.line ||
      change.text.includes('\n') ||
      change.text.includes('\r') ||
      change.text.includes('|')
    ) {
      return false;
    }

    const oldText = cached.text;
    const changeStart = change.rangeOffset;
    const changeEnd = change.rangeOffset + change.rangeLength;
    if (changeStart < 0 || changeEnd > oldText.length) {
      return false;
    }

    const removedText = oldText.slice(changeStart, changeEnd);
    if (removedText.includes('\n') || removedText.includes('\r') || removedText.includes('|')) {
      return false;
    }

    // Locate the cached table scope containing this edit.
    let targetOrigStart = -1;
    let targetOrigEnd = -1;
    for (const scope of cached.scopes) {
      if (scope.kind !== 'table') continue;
      const origStart = mapNormalizedToOriginal(scope.startPos, oldText);
      const origEnd = mapNormalizedToOriginal(scope.endPos, oldText);
      if (changeStart >= origStart && changeEnd <= origEnd) {
        targetOrigStart = origStart;
        targetOrigEnd = origEnd;
        break;
      }
    }

    if (targetOrigStart === -1) {
      return false;
    }

    // Expand to full line boundaries of the table in oldText.
    const origLineStart = targetOrigStart === 0 ? 0 : oldText.lastIndexOf('\n', targetOrigStart - 1) + 1;
    const nextNl = oldText.indexOf('\n', targetOrigEnd);
    const origLineEnd =
      nextNl === -1
        ? oldText.length
        : nextNl > 0 && oldText.charCodeAt(nextNl - 1) === 13
          ? nextNl - 1
          : nextNl;

    const delta = change.text.length - change.rangeLength;
    const newText = document.getText();
    const newTableEnd = origLineEnd + delta;
    if (newTableEnd < origLineStart || newTableEnd > newText.length) {
      return false;
    }

    const normLineStart = mapOriginalToNormalized(origLineStart, oldText);
    const normLineEnd = mapOriginalToNormalized(origLineEnd, oldText);
    const newTableSlice = newText.slice(origLineStart, newTableEnd);
    if (normLineStart === 0 && newTableSlice.trimStart().startsWith('---')) {
      return false;
    }

    const sliceStart = Date.now();
    const sliceResult = this.parser.extractDecorationsWithScopes(newTableSlice);
    const hasTable = sliceResult.scopes.some((s) => s.kind === 'table');
    if (!hasTable) {
      return false;
    }

    cached.version = document.version;
    cached.text = newText;
    cached.decorations = spliceAndShift(
      cached.decorations,
      sliceResult.decorations,
      normLineStart,
      normLineEnd,
      delta,
      true
    );
    cached.scopes = spliceAndShift(
      cached.scopes,
      sliceResult.scopes,
      normLineStart,
      normLineEnd,
      delta,
      true
    );
    cached.mermaidBlocks = spliceAndShift(
      cached.mermaidBlocks,
      [],
      normLineStart,
      normLineEnd,
      delta
    );
    cached.mathRegions = spliceAndShift(
      cached.mathRegions,
      sliceResult.mathRegions,
      normLineStart,
      normLineEnd,
      delta
    );
    cached.lastAccessed = ++this.accessCounter;

    logPerformanceMetric('parse-cache.incremental-table', {
      uri: cacheKey,
      version: document.version,
      parseMs: Date.now() - sliceStart,
      sliceLength: newTableSlice.length,
    });
    return true;
  }

  invalidate(document: vscode.TextDocument): void {
    this.cache.delete(document.uri.toString());
  }

  clear(documentUri?: string): void {
    if (documentUri) {
      this.cache.delete(documentUri);
      return;
    }
    this.cache.clear();
  }

  private evictLRU(): void {
    let lruKey: string | undefined;
    let lruAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruAccess) {
        lruAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      logDebug('parse cache evict', { uri: lruKey });
      this.cache.delete(lruKey);
    }
  }
}
