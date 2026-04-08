import type * as vscode from 'vscode';
import type { DecorationRange, ScopeRange, MermaidBlock, MathRegion, MarkdownParser } from './parser';
import { logDebug, logPerformanceMetric } from './logging';

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
