/**
 * Tests for math reveal-on-select: when selection/cursor is inside a math region,
 * raw LaTeX is shown (no math decoration applied for that region).
 */

import type { Mock } from 'vitest';

vi.mock('../../math/math-renderer', () => ({
  renderMathToDataUri: vi.fn((source: string) => `data:image/svg+xml,${source}`),
}));

import { Decorator } from '../../decorator';
import { config } from '../../config';
import { TextDocument, TextEditor, Selection, Position, Uri } from '../../test/__mocks__/vscode';

const text = 'Before $E = mc^2$ after';
const mathRegions = [
  { startPos: 7, endPos: 16, source: 'E = mc^2', displayMode: false },
];

function createDecoratorWithMathCache(customText?: string, customMathRegions?: typeof mathRegions): Decorator & {
  parseCache: { get: (doc: ReturnType<typeof TextDocument>) => unknown };
  applyMathDecorations: (regions: typeof mathRegions, normalizedText: string) => void;
  mathDecorations: { apply: Mock; clear: Mock };
} {
  const entry = {
    version: 1,
    text: customText ?? text,
    decorations: [],
    scopes: [],
    mermaidBlocks: [],
    mathRegions: customMathRegions ?? mathRegions,
  };
  const parseCache = {
    get: () => entry,
    invalidate: () => {},
    clear: () => {},
  };
  const decorator = new Decorator(parseCache as any) as any;
  decorator.mathDecorations = {
    apply: vi.fn(),
    clear: vi.fn(),
  };
  return decorator;
}

describe('Decorator - Math reveal on select', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies math decoration when cursor is outside math region', () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const cursorOutside = new Position(0, 0);
    const editor = new TextEditor(document, [new Selection(cursorOutside, cursorOutside)]);
    const decorator = createDecoratorWithMathCache();
    decorator.setActiveEditor(editor);
    (decorator as any).updateDecorationsInternal();

    expect(decorator.mathDecorations.apply).toHaveBeenCalled();
    const calls = (decorator.mathDecorations.apply as Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    const regionsWithRanges = lastCall[1];
    expect(regionsWithRanges).toHaveLength(1);
    expect(regionsWithRanges[0].range).not.toBeNull();
  });

  it('does not apply math decoration when cursor is inside math region', () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const cursorInside = new Position(0, 10);
    const editor = new TextEditor(document, [new Selection(cursorInside, cursorInside)]);
    const decorator = createDecoratorWithMathCache();
    decorator.setActiveEditor(editor);
    (decorator as any).updateDecorationsInternal();

    expect(decorator.mathDecorations.apply).toHaveBeenCalled();
    const calls = (decorator.mathDecorations.apply as Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    const regionsWithRanges = lastCall[1];
    expect(regionsWithRanges).toHaveLength(1);
    expect(regionsWithRanges[0].range).toBeNull();
  });

  it('shows raw when selection overlaps math region', () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const selection = new Selection(new Position(0, 5), new Position(0, 12));
    const editor = new TextEditor(document, [selection]);
    const decorator = createDecoratorWithMathCache();
    decorator.setActiveEditor(editor);
    (decorator as any).updateDecorationsInternal();

    expect(decorator.mathDecorations.apply).toHaveBeenCalled();
    const calls = (decorator.mathDecorations.apply as Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    const regionsWithRanges = lastCall[1];
    expect(regionsWithRanges[0].range).toBeNull();
  });

  it('reveals raw fenced math content when cursor is inside fence body', () => {
    const fencedText = ['```math', '\\frac{1}{2}', '```'].join('\n');
    const fencedRegion = [
      { startPos: 0, endPos: fencedText.length, source: '\\frac{1}{2}\n', displayMode: true, numLines: 1 },
    ];
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, fencedText);
    const cursorInside = new Position(1, 2);
    const editor = new TextEditor(document, [new Selection(cursorInside, cursorInside)]);
    const decorator = createDecoratorWithMathCache(fencedText, fencedRegion);
    decorator.setActiveEditor(editor);
    (decorator as any).updateDecorationsInternal();

    const lastCall = (decorator.mathDecorations.apply as Mock).mock.calls.slice(-1)[0];
    const regionsWithRanges = lastCall[1];
    expect(regionsWithRanges).toHaveLength(1);
    expect(regionsWithRanges[0].range).toBeNull();
  });

  it('passes fenced math range for rendering when cursor is outside', () => {
    const fencedText = 'before\n```tex\n\\invalid{\n```';
    const fenceStart = 7;
    const fenceEnd = fencedText.length;
    const fencedRegion = [
      { startPos: fenceStart, endPos: fenceEnd, source: '\\invalid{\n', displayMode: true, numLines: 1 },
    ];
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, fencedText);
    const cursorOutside = new Position(0, 0);
    const editor = new TextEditor(document, [new Selection(cursorOutside, cursorOutside)]);
    const decorator = createDecoratorWithMathCache(fencedText, fencedRegion);
    decorator.setActiveEditor(editor);
    (decorator as any).updateDecorationsInternal();

    const lastCall = (decorator.mathDecorations.apply as Mock).mock.calls.slice(-1)[0];
    const regionsWithRanges = lastCall[1];
    expect(regionsWithRanges[0].range).not.toBeNull();
  });

  it('applies decorations for multiple math fences with numLines (height differs by body lines)', () => {
    const text = 'pre\n```math\nx\n```\n```math\na\nb\nc\n```';
    const regions = [
      { startPos: 4, endPos: 18, source: 'x\n', displayMode: true, numLines: 1 },
      { startPos: 19, endPos: 36, source: 'a\nb\nc\n', displayMode: true, numLines: 3 },
    ];
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const editor = new TextEditor(document, [new Selection(new Position(0, 0), new Position(0, 0))]);
    const decorator = createDecoratorWithMathCache(text, regions);
    decorator.setActiveEditor(editor);
    (decorator as any).updateDecorationsInternal();

    expect(decorator.mathDecorations.apply).toHaveBeenCalled();
    const lastCall = (decorator.mathDecorations.apply as Mock).mock.calls.slice(-1)[0];
    const regionsWithRanges = lastCall[1];
    expect(regionsWithRanges).toHaveLength(2);
    expect(regionsWithRanges[0].region.numLines).toBe(1);
    expect(regionsWithRanges[1].region.numLines).toBe(3);
    expect(regionsWithRanges[0].range).not.toBeNull();
    expect(regionsWithRanges[1].range).not.toBeNull();
  });

  it('invalid fence LaTeX: apply is called and does not throw (raw remains visible when render returns null)', () => {
    const fencedText = 'pre\n```math\n\\invalid{\n```';
    const fencedRegion = [
      { startPos: 4, endPos: fencedText.length, source: '\\invalid{\n', displayMode: true, numLines: 1 },
    ];
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, fencedText);
    const editor = new TextEditor(document, [new Selection(new Position(0, 0), new Position(0, 0))]);
    const decorator = createDecoratorWithMathCache(fencedText, fencedRegion);
    decorator.setActiveEditor(editor);
    expect(() => (decorator as any).updateDecorationsInternal()).not.toThrow();
    expect(decorator.mathDecorations.apply).toHaveBeenCalled();
    const lastCall = (decorator.mathDecorations.apply as Mock).mock.calls.slice(-1)[0];
    expect(lastCall[1]).toHaveLength(1);
    expect(lastCall[1][0].region.source).toBe('\\invalid{\n');
  });

  it('clears math decorations when math setting is disabled', () => {
    vi.spyOn(config.math, 'enabled').mockReturnValue(false);

    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const editor = new TextEditor(document, [new Selection(new Position(0, 0), new Position(0, 0))]);
    const decorator = createDecoratorWithMathCache();
    decorator.setActiveEditor(editor);
    (decorator as any).updateDecorationsInternal();

    expect(decorator.mathDecorations.clear).toHaveBeenCalled();
    expect(decorator.mathDecorations.apply).not.toHaveBeenCalled();
  });

  it('delimiter math and fence math in same document: both get ranges when cursor outside', () => {
    const docText = '$x$\n\n```math\nE=mc^2\n```';
    const regions = [
      { startPos: 0, endPos: 3, source: 'x', displayMode: false },
      { startPos: 5, endPos: docText.length, source: 'E=mc^2\n', displayMode: true, numLines: 1 },
    ];
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, docText);
    const editor = new TextEditor(document, [new Selection(new Position(1, 0), new Position(1, 0))]);
    const decorator = createDecoratorWithMathCache(docText, regions);
    decorator.setActiveEditor(editor);
    (decorator as any).updateDecorationsInternal();

    const lastCall = (decorator.mathDecorations.apply as Mock).mock.calls.slice(-1)[0];
    const regionsWithRanges = lastCall[1];
    expect(regionsWithRanges).toHaveLength(2);
    expect(regionsWithRanges[0].range).not.toBeNull();
    expect(regionsWithRanges[1].range).not.toBeNull();
  });
});
