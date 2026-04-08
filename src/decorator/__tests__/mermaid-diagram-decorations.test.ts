import type { Mock } from 'vitest';
import { MermaidDiagramDecorations } from '../mermaid-diagram-decorations';
import { window, ColorThemeKind, Range } from '../../test/__mocks__/vscode';

/** Minimal TextEditor stub — tracks setDecorations calls per type. */
function makeEditor() {
  const calls = new Map<any, any[][]>();
  return {
    setDecorations: vi.fn((type: any, ranges: any[]) => {
      const prev = calls.get(type) ?? [];
      prev.push(ranges);
      calls.set(type, prev);
    }),
    _calls: calls,
  };
}

function makeRanges(n = 1) {
  return Array.from(
    { length: n },
    (_, i) => new Range({ line: i, character: 0 }, { line: i, character: 5 }),
  );
}

describe('MermaidDiagramDecorations', () => {
  beforeEach(() => {
    // Default to dark theme
    (window.activeColorTheme as any).kind = ColorThemeKind.Dark;
    (window.createTextEditorDecorationType as Mock).mockClear();
  });

  describe('apply()', () => {
    it('calls setDecorations for each key that has both a dataUri and ranges', () => {
      const mdd = new MermaidDiagramDecorations();
      const editor = makeEditor();
      const ranges = new Map([['k1', makeRanges()]]);
      const uris = new Map([['k1', 'data:image/svg+xml;base64,abc']]);

      mdd.apply(editor as any, ranges, uris);

      expect(editor.setDecorations).toHaveBeenCalledTimes(1);
    });

    it('skips keys with no matching dataUri', () => {
      const mdd = new MermaidDiagramDecorations();
      const editor = makeEditor();
      const ranges = new Map([['k1', makeRanges()]]);
      const uris = new Map<string, string>(); // no entry for k1

      mdd.apply(editor as any, ranges, uris);

      expect(editor.setDecorations).not.toHaveBeenCalled();
    });

    it('skips keys with empty ranges array', () => {
      const mdd = new MermaidDiagramDecorations();
      const editor = makeEditor();
      const ranges = new Map([['k1', []]]);
      const uris = new Map([['k1', 'data:image/svg+xml;base64,abc']]);

      mdd.apply(editor as any, ranges, uris);

      expect(editor.setDecorations).not.toHaveBeenCalled();
    });

    it('reuses cached decoration type for same key + same theme', () => {
      const mdd = new MermaidDiagramDecorations();
      const editor = makeEditor();
      const ranges = new Map([['k1', makeRanges()]]);
      const uris = new Map([['k1', 'data:image/svg+xml;base64,abc']]);

      mdd.apply(editor as any, ranges, uris);
      const firstType = editor.setDecorations.mock.calls[0][0];

      mdd.apply(editor as any, ranges, uris);
      const secondType = editor.setDecorations.mock.calls[1][0];

      expect(firstType).toBe(secondType);
      expect(window.createTextEditorDecorationType).toHaveBeenCalledTimes(1);
    });

    it('creates a new decoration type when the theme changes', () => {
      const mdd = new MermaidDiagramDecorations();
      const editor = makeEditor();
      const ranges = new Map([['k1', makeRanges()]]);
      const uris = new Map([['k1', 'data:image/svg+xml;base64,abc']]);

      (window.activeColorTheme as any).kind = ColorThemeKind.Dark;
      mdd.apply(editor as any, ranges, uris);
      const firstType = editor.setDecorations.mock.calls[0][0];

      // Switch to light theme
      (window.activeColorTheme as any).kind = ColorThemeKind.Light;
      mdd.apply(editor as any, ranges, uris);
      const secondType = editor.setDecorations.mock.calls[1][0];

      expect(firstType).not.toBe(secondType);
      expect(window.createTextEditorDecorationType).toHaveBeenCalledTimes(2);
      // Old entry must be disposed when theme changes
      expect(firstType.dispose).toHaveBeenCalled();
    });

    it('disposes and clears entries not present in the new apply call', () => {
      const mdd = new MermaidDiagramDecorations();
      const editor = makeEditor();

      // First call: two keys
      mdd.apply(
        editor as any,
        new Map([['k1', makeRanges()], ['k2', makeRanges()]]),
        new Map([['k1', 'data:a'], ['k2', 'data:b']])
      );
      const k1Type = editor.setDecorations.mock.calls[0][0];
      editor.setDecorations.mockClear();

      // Second call: only k2 — k1 should be disposed
      mdd.apply(
        editor as any,
        new Map([['k2', makeRanges()]]),
        new Map([['k2', 'data:b']])
      );

      expect(k1Type.dispose).toHaveBeenCalled();
      // setDecorations([]) for k1, then setDecorations(ranges) for k2
      const calls = editor.setDecorations.mock.calls;
      const clearCall = calls.find(([t, r]) => t === k1Type && r.length === 0);
      expect(clearCall).toBeDefined();
    });

    it('handles HighContrast theme as dark', () => {
      const mdd = new MermaidDiagramDecorations();
      const editor = makeEditor();
      (window.activeColorTheme as any).kind = ColorThemeKind.HighContrast;

      mdd.apply(
        editor as any,
        new Map([['k1', makeRanges()]]),
        new Map([['k1', 'data:a']])
      );

      expect(editor.setDecorations).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear()', () => {
    it('calls setDecorations([]) and dispose() for all cached entries', () => {
      const mdd = new MermaidDiagramDecorations();
      const editor = makeEditor();

      mdd.apply(
        editor as any,
        new Map([['k1', makeRanges()], ['k2', makeRanges()]]),
        new Map([['k1', 'data:a'], ['k2', 'data:b']])
      );
      const types = editor.setDecorations.mock.calls.map(([t]) => t);
      editor.setDecorations.mockClear();

      mdd.clear(editor as any);

      // Each cached type gets setDecorations([]) and dispose()
      for (const t of types) {
        expect(t.dispose).toHaveBeenCalled();
        const clearCall = editor.setDecorations.mock.calls.find(([ct, r]) => ct === t && r.length === 0);
        expect(clearCall).toBeDefined();
      }
    });

    it('leaves the cache empty after clear()', () => {
      const mdd = new MermaidDiagramDecorations();
      const editor = makeEditor();

      mdd.apply(
        editor as any,
        new Map([['k1', makeRanges()]]),
        new Map([['k1', 'data:a']])
      );
      mdd.clear(editor as any);

      // A second clear should do nothing (cache is empty)
      editor.setDecorations.mockClear();
      mdd.clear(editor as any);
      expect(editor.setDecorations).not.toHaveBeenCalled();
    });
  });

  describe('LRU eviction', () => {
    // evictIfNeeded fires inside getOrCreateEntry when the cache exceeds
    // maxEntries. The entry with the lowest lastUsed counter (first inserted
    // in the current apply call) is the LRU and gets evicted.
    it('evicts the first-inserted entry when a single apply call exceeds maxEntries', () => {
      const mdd = new MermaidDiagramDecorations(2); // maxEntries = 2
      const editor = makeEditor();

      // One apply with 3 keys: k1(lastUsed=1), k2(lastUsed=2), k3(lastUsed=3).
      // After k3 is inserted evictIfNeeded runs: k1 is LRU (lastUsed=1) → evicted.
      mdd.apply(
        editor as any,
        new Map([['k1', makeRanges()], ['k2', makeRanges()], ['k3', makeRanges()]]),
        new Map([['k1', 'data:1'], ['k2', 'data:2'], ['k3', 'data:3']])
      );

      // setDecorations was called for all three keys (eviction happens after insertion)
      const k1Type = editor.setDecorations.mock.calls[0][0];
      const k2Type = editor.setDecorations.mock.calls[1][0];

      expect(k1Type.dispose).toHaveBeenCalled(); // evicted (lowest lastUsed)
      expect(k2Type.dispose).not.toHaveBeenCalled(); // survives
    });

    it('evicts whichever key has the lowest lastUsed at eviction time', () => {
      const mdd = new MermaidDiagramDecorations(2);
      const editor = makeEditor();

      // k2 is first in the map → lastUsed=1 (LRU); k1 is second → lastUsed=2.
      // k2 is evicted when k3 pushes the cache over the limit.
      mdd.apply(
        editor as any,
        new Map([['k2', makeRanges()], ['k1', makeRanges()], ['k3', makeRanges()]]),
        new Map([['k2', 'data:2'], ['k1', 'data:1'], ['k3', 'data:3']])
      );

      const k2Type = editor.setDecorations.mock.calls[0][0]; // k2 processed first
      const k1Type = editor.setDecorations.mock.calls[1][0]; // k1 processed second

      expect(k2Type.dispose).toHaveBeenCalled(); // k2 is LRU
      expect(k1Type.dispose).not.toHaveBeenCalled(); // k1 survives
    });
  });
});
