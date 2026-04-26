vi.mock('../../parser', () => ({
  MarkdownParser: class {
    extractDecorations() { return []; }
  },
}));

import { filterDecorationsForEditor } from '../visibility-model';
import type { ScopeEntry } from '../visibility-model';
import type { DecorationRange } from '../../parser';
import { config } from '../../config';
import { TextDocument, TextEditor, Selection, Position, Uri, Range } from '../../test/__mocks__/vscode';

function makeEditor(text: string, cursorLine: number, cursorChar: number) {
  const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
  const sel = new Selection(new Position(cursorLine, cursorChar), new Position(cursorLine, cursorChar));
  return new TextEditor(doc, [sel]);
}

function makeEditorWithSelection(text: string, startLine: number, startChar: number, endLine: number, endChar: number) {
  const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
  const sel = new Selection(new Position(startLine, startChar), new Position(endLine, endChar));
  return new TextEditor(doc, [sel]);
}

function simpleRangeFactory(startPos: number, endPos: number, text: string) {
  const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
  return new Range(doc.positionAt(startPos), doc.positionAt(endPos)) as any;
}

/** Filtered table/emoji entries use `renderOptions.before` (not plain `Range`). */
function beforeAttachment(
  item: unknown,
): { contentText?: string; width?: string; fontWeight?: string } | undefined {
  if (!item || typeof item !== 'object' || !('renderOptions' in item)) {
    return undefined;
  }
  const ro = (item as { renderOptions?: { before?: Record<string, unknown> } }).renderOptions;
  return ro?.before as { contentText?: string; width?: string; fontWeight?: string } | undefined;
}

describe('emoji decoration', () => {
  it('renders emoji replacement when cursor is not on the emoji line', () => {
    const text = ':smile:\nother line';
    const decs = [
      { startPos: 0, endPos: 7, type: 'emoji' as const, emoji: '😊' },
    ] satisfies DecorationRange[];
    const editor = makeEditor(text, 1, 0); // cursor on line 1, not line 0
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const emojis = result.get('emoji');
    expect(emojis).toBeDefined();
    expect(emojis!.length).toBe(1);
    expect(beforeAttachment(emojis![0])?.contentText).toBe('😊');
  });

  it('skips emoji when cursor is inside the emoji scope (raw reveal)', () => {
    const text = ':smile:';
    const decs = [
      { startPos: 0, endPos: 7, type: 'emoji' as const, emoji: '😊' },
    ] satisfies DecorationRange[];
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const scope: ScopeEntry = {
      startPos: 0,
      endPos: 7,
      range: new Range(doc.positionAt(0), doc.positionAt(7)) as any,
    };
    const editor = makeEditor(text, 0, 3); // cursor inside emoji on line 0
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [scope],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('emoji')).toBe(false);
  });

  it('does not render emoji without emoji property', () => {
    const text = ':smile:\nother';
    const decs = [{ startPos: 0, endPos: 7, type: 'emoji' as const }] satisfies DecorationRange[];
    const editor = makeEditor(text, 1, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('emoji')).toBe(false);
  });
});

describe('table decoration rendering', () => {
  it('renders tablePipe with replacement text when cursor is off the table', () => {
    const text = '| A |\n| - |\nother';
    const decs = [
      { startPos: 0, endPos: 1, type: 'tablePipe' as const, replacement: '│' },
    ] satisfies DecorationRange[];
    const editor = makeEditor(text, 2, 0); // cursor below table on line 2
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const pipes = result.get('tablePipe');
    expect(pipes).toBeDefined();
    expect(beforeAttachment(pipes![0])?.contentText).toBe('│');
  });

  it('prepends replacementPrefix to tablePipe before content', () => {
    const text = '| x |\nother';
    const decs = [
      {
        startPos: 4,
        endPos: 5,
        type: 'tablePipe' as const,
        replacement: '│',
        replacementPrefix: '\u00A0\u00A0',
      },
    ] satisfies DecorationRange[];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const pipes = result.get('tablePipe');
    expect(beforeAttachment(pipes![0])?.contentText).toBe('\u00A0\u00A0│');
  });

  it('skips table decorations when cursor is on the table (whole-block reveal)', () => {
    const text = '| A |\n| - |';
    const decs = [
      { startPos: 0, endPos: 1, type: 'tablePipe' as const, replacement: '│' },
    ] satisfies DecorationRange[];
    const doc = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: 11,
      range: new Range(new Position(0, 0), new Position(1, 5)) as any,
      kind: 'table',
    };
    const editor = makeEditor(text, 0, 2); // cursor on table line 0
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [tableScope],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('tablePipe')).toBe(false);
  });

  it('renders tableCell with cellStyle properties', () => {
    const text = '| **bold** |\nother';
    const decs = [
      {
        startPos: 0,
        endPos: 1,
        type: 'tableCell' as const,
        replacement: ' bold ',
        cellStyle: { fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none' },
      },
    ] satisfies DecorationRange[];
    const editor = makeEditor(text, 1, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const cells = result.get('tableCell');
    expect(cells).toBeDefined();
    const before = beforeAttachment(cells![0]);
    expect(before?.contentText).toBe(' bold ');
    expect(before?.fontWeight).toBe('bold');
  });

  it('sets width in ch on tableCell before attachment when tableCellWidthCh is set', () => {
    const text = '| x |\nother';
    const decs = [
      {
        startPos: 1,
        endPos: 4,
        type: 'tableCell' as const,
        replacement: '\u00A0x\u00A0\u00A0',
        tableCellWidthCh: 7,
      },
    ] satisfies DecorationRange[];
    const editor = makeEditor(text, 1, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const cells = result.get('tableCell');
    expect(beforeAttachment(cells![0])?.width).toBe('7ch');
  });

  it('does not set before.width on tableCell when tableCellWidthCh is omitted', () => {
    const text = '| x |\nother';
    const decs = [
      {
        startPos: 1,
        endPos: 4,
        type: 'tableCell' as const,
        replacement: '\u00A0x\u00A0\u00A0',
      },
    ] satisfies DecorationRange[];
    const editor = makeEditor(text, 1, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const cells = result.get('tableCell');
    expect(beforeAttachment(cells![0])?.width).toBeUndefined();
  });

  it('skips tableCellNativePad when cursor is on the table', () => {
    const text = '| A |\n| - |';
    const decs = [
      {
        startPos: 5,
        endPos: 5,
        type: 'tableCellNativePad' as const,
        replacement: '\u00A0\u00A0',
      },
    ] satisfies DecorationRange[];
    const tableScope: ScopeEntry = {
      startPos: 0,
      endPos: 11,
      range: new Range(new Position(0, 0), new Position(1, 5)) as any,
      kind: 'table',
    };
    const editor = makeEditor(text, 0, 2);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [tableScope],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('tableCellNativePad')).toBe(false);
  });
});

describe('headingNest', () => {
  beforeEach(() => {
    vi.spyOn(config.headings.nest, 'indentPerLevelCh').mockReturnValue(1);
    vi.spyOn(config.headings.nest, 'showIndentGuides').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders before width from nestSteps when cursor is not on that line', () => {
    const text = '## H\n\nx';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 4, type: 'headingNest', nestSteps: 2 } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const nests = result.get('headingNest') as any[];
    expect(nests?.length).toBe(1);
    expect(nests[0].renderOptions?.before?.width).toBe('2ch');
  });

  it('omits headingNest on the active line', () => {
    const text = '## H\n';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 4, type: 'headingNest', nestSteps: 2 } as any,
    ];
    const editor = makeEditor(text, 0, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('headingNest')).toBe(false);
  });

  it('uses inset box-shadow for indent guides instead of a full border', () => {
    vi.spyOn(config.headings.nest, 'showIndentGuides').mockReturnValue(true);
    const text = '## H\n\nx';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 4, type: 'headingNest', nestSteps: 1 } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const before = (result.get('headingNest') as any[])[0].renderOptions.before;
    expect(before.textDecoration).toContain('box-shadow');
    expect(before.textDecoration).toContain('inset');
    expect(before.border).toBeUndefined();
    expect(before.borderColor).toBeUndefined();
  });
});

describe('selection overlay for codeBlock/frontmatter', () => {
  it('adds selectionOverlay when non-empty selection covers a codeBlock', () => {
    const text = '```\ncode\n```';
    const decs = [{ startPos: 0, endPos: 12, type: 'codeBlock' as const }] satisfies DecorationRange[];
    const editor = makeEditorWithSelection(text, 0, 0, 2, 3); // non-empty selection
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('selectionOverlay')).toBe(true);
  });

  it('adds selectionOverlay when selection covers frontmatter', () => {
    const text = '---\ntitle: hi\n---';
    const decs = [{ startPos: 0, endPos: 17, type: 'frontmatter' as const }] satisfies DecorationRange[];
    const editor = makeEditorWithSelection(text, 0, 0, 1, 5); // non-empty selection
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('selectionOverlay')).toBe(true);
  });

  it('does not add selectionOverlay when there is no selection (cursor only)', () => {
    const text = '```\ncode\n```';
    const decs = [{ startPos: 0, endPos: 12, type: 'codeBlock' as const }] satisfies DecorationRange[];
    const editor = makeEditor(text, 1, 2); // cursor-only (isEmpty)
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('selectionOverlay')).toBe(false);
  });
});

describe('ordered list auto-numbering decoration', () => {
  it('renders replacement text when cursor is not on the list line', () => {
    const text = '1. First\n1. Second\n1. Third\nother line';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '1. ' } as any,
      { startPos: 9, endPos: 12, type: 'orderedListItem', replacement: '2. ' } as any,
      { startPos: 19, endPos: 22, type: 'orderedListItem', replacement: '3. ' } as any,
    ];
    const editor = makeEditor(text, 3, 0); // cursor on "other line"
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    expect(items).toBeDefined();
    expect(items).toHaveLength(3);
    expect(items[0].renderOptions?.before?.contentText).toBe('1. ');
    expect(items[1].renderOptions?.before?.contentText).toBe('2. ');
    expect(items[2].renderOptions?.before?.contentText).toBe('3. ');
  });

  it('skips orderedListItem when cursor overlaps marker range (raw reveal)', () => {
    const text = '1. First\n1. Second';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '1. ' } as any,
      { startPos: 9, endPos: 12, type: 'orderedListItem', replacement: '2. ' } as any,
    ];
    const editor = makeEditor(text, 0, 1); // cursor inside "1. " marker on line 0
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    // Line 0 marker should be skipped (raw reveal), line 1 should render
    expect(items).toBeDefined();
    expect(items).toHaveLength(1);
    expect(items[0].renderOptions?.before?.contentText).toBe('2. ');
  });

  it('renders parenthesis delimiter in replacement', () => {
    const text = '1) First\n1) Second\nother';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '1) ' } as any,
      { startPos: 9, endPos: 12, type: 'orderedListItem', replacement: '2) ' } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    expect(items).toBeDefined();
    expect(items).toHaveLength(2);
    expect(items[0].renderOptions?.before?.contentText).toBe('1) ');
    expect(items[1].renderOptions?.before?.contentText).toBe('2) ');
  });

  it('renders custom start number in replacement', () => {
    const text = '5. Start here\n1. Next\nother';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '5. ' } as any,
      { startPos: 14, endPos: 17, type: 'orderedListItem', replacement: '6. ' } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    expect(items).toBeDefined();
    expect(items[0].renderOptions?.before?.contentText).toBe('5. ');
    expect(items[1].renderOptions?.before?.contentText).toBe('6. ');
  });

  it('uses warning foreground color when orderedListMarkerMismatch is set', () => {
    const text = '1. First\n1. Second\nother';
    const decs: DecorationRange[] = [
      { startPos: 0, endPos: 3, type: 'orderedListItem', replacement: '1. ' } as any,
      {
        startPos: 9,
        endPos: 12,
        type: 'orderedListItem',
        replacement: '2. ',
        orderedListMarkerMismatch: true,
      } as any,
    ];
    const editor = makeEditor(text, 2, 0);
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    const items = result.get('orderedListItem') as any[];
    expect(items[0].renderOptions?.before?.color).toBeUndefined();
    expect(items[1].renderOptions?.before?.color?.id).toBe('editorWarning.foreground');
  });
});

describe('filterDecorationsForEditor — basic cases', () => {
  it('returns empty map when no decorations', () => {
    const editor = makeEditor('hello', 0, 0);
    const result = filterDecorationsForEditor(editor as any, [], [], 'hello', (s, e, t) => simpleRangeFactory(s, e, t));
    expect(result.size).toBe(0);
  });

  it('applies non-marker semantic decorations on non-active lines', () => {
    const text = 'hello\n**bold**';
    const decs = [
      { startPos: 6, endPos: 8, type: 'hide' as const },
      { startPos: 8, endPos: 12, type: 'bold' as const },
      { startPos: 12, endPos: 14, type: 'hide' as const },
    ] satisfies DecorationRange[];
    const editor = makeEditor(text, 0, 0); // cursor on line 0, decoration on line 1
    const result = filterDecorationsForEditor(
      editor as any,
      decs,
      [],
      text,
      (s, e, t) => simpleRangeFactory(s, e, t),
    );
    expect(result.has('bold')).toBe(true);
    expect(result.has('hide')).toBe(true);
  });
});
