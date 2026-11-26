import * as vscode from 'vscode';
import { MarkdownParser } from '../../parser';
import { MarkdownParseCache } from '../../markdown-parse-cache';
import {
  buildRenderedEditMap,
  computeSelectionDeletionRanges,
  computeSingleCharDeletionRanges,
  extractVisibleText,
  findVisibleWordBoundary,
} from '../marker-map';

function makeDoc(text: string) {
  return new (vscode.TextDocument as any)(vscode.Uri.file('/test.md'), 'markdown', 1, text);
}

describe('rendered-edit marker-map', () => {
  let parser: MarkdownParser;
  let cache: MarkdownParseCache;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
    cache = new MarkdownParseCache(parser);
  });

  it('skips hidden closing bold markers on Delete and deletes the next visible character', () => {
    const text = '**bold** next';
    const doc = makeDoc(text);
    const map = buildRenderedEditMap(doc, cache.get(doc));

    // Caret positioned right after `bold`, before closing `**` (offset 6).
    const dels = computeSingleCharDeletionRanges(doc, map, 6, 'forward');
    expect(dels).toEqual([{ start: 8, end: 9 }]); // space after **
  });

  it('skips hidden opening markers on Backspace and cleans up emptied constructs', () => {
    const text = '**a** next';
    const doc = makeDoc(text);
    const map = buildRenderedEditMap(doc, cache.get(doc));

    // Backspace after `a` (offset 3) removes the last visible char and cleans up `**a**`.
    const dels = computeSingleCharDeletionRanges(doc, map, 3, 'backward');
    expect(dels).toEqual([{ start: 0, end: 5 }]);
  });

  it('protects line-prefix markers from accidental Backspace', () => {
    const text = '- item';
    const doc = makeDoc(text);
    const map = buildRenderedEditMap(doc, cache.get(doc));

    // Caret right after `- ` (offset 2).
    const dels = computeSingleCharDeletionRanges(doc, map, 2, 'backward');
    expect(dels).toEqual([]);
  });

  it('preserves markers for partially selected constructs and deletes fully covered ones', () => {
    const text = 'pre **first** mid **second** post';
    const doc = makeDoc(text);
    const map = buildRenderedEditMap(doc, cache.get(doc));

    // Select from `first` through `sec` of `second` (offsets 6..23):
    // `**first**` is fully covered in visible text -> deleted with markers;
    // `**second**` is only partially covered -> markers stay, only `sec` is deleted.
    const dels = computeSelectionDeletionRanges(doc, map, 6, 23);
    const apply = (src: string, ranges: Array<{ start: number; end: number }>) => {
      let out = src;
      for (const r of [...ranges].sort((a, b) => b.start - a.start)) {
        out = out.slice(0, r.start) + out.slice(r.end);
      }
      return out;
    };

    expect(apply(text, dels)).toBe('pre **ond** post');
  });

  it('protects table pipes and separator lines from single-char deletion', () => {
    const text = '| A | B |\n|---|---|\n| 1 | 2 |';
    const doc = makeDoc(text);
    const map = buildRenderedEditMap(doc, cache.get(doc));

    const aEnd = text.indexOf('A') + 1;
    expect(computeSingleCharDeletionRanges(doc, map, aEnd, 'forward')).toEqual([]);

    const bStart = text.indexOf('B');
    expect(computeSingleCharDeletionRanges(doc, map, bStart, 'backward')).toEqual([]);
  });

  it('extracts visible text without markdown syntax and separates table columns with tabs', () => {
    const text = '- **Hello** [link](https://example.com) and `code`\n\n| A | B |\n|---|---|\n| 1 | 2 |';
    const doc = makeDoc(text);
    const entry = cache.get(doc);
    const map = buildRenderedEditMap(doc, entry);

    const visible = extractVisibleText(doc, entry, map, 0, text.length);
    expect(visible).toBe('• Hello link and code\n\nA\tB\n\n1\t2');
  });

  it('finds visible word boundaries across hidden markers', () => {
    const text = 'one **two** three';
    const doc = makeDoc(text);
    const map = buildRenderedEditMap(doc, cache.get(doc));

    // From offset 0, Ctrl+Right skips `one` -> offset 3; from offset 4 (before `**`), skips `**two**` -> offset 11.
    expect(findVisibleWordBoundary(text, map, 0, 'forward')).toBe(3);
    expect(findVisibleWordBoundary(text, map, 4, 'forward')).toBe(11);
  });
});
