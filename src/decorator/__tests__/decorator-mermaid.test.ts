vi.mock('../../mermaid/mermaid-renderer', () => ({
  initMermaidRenderer: vi.fn(),
  renderMermaidSvg: vi.fn(),
  svgToDataUri: vi.fn((svg: string) => `data:${svg}`),
  createErrorSvg: vi.fn(() => '<svg></svg>'),
  saveSvgToHtml: vi.fn(),
  disposeMermaidRenderer: vi.fn(),
}));

import { Decorator } from '../../decorator';
import { MarkdownParseCache } from '../../markdown-parse-cache';
import { TextDocument, TextEditor, Selection, Range, Position, Uri } from '../../test/__mocks__/vscode';
import { renderMermaidSvg } from '../../mermaid/mermaid-renderer';

const mockRenderMermaidSvg = vi.mocked(renderMermaidSvg);

describe('Decorator - Mermaid diagrams', () => {
  const blockText = [
    '```mermaid',
    'graph TD',
    '  A --> B',
    '```',
  ].join('\n');
  const text = `${blockText}\nAfter`;

  const mermaidBlocks = [
    {
      startPos: 0,
      endPos: blockText.length,
      source: 'graph TD\n  A --> B',
      numLines: 2,
    },
  ];

  beforeEach(() => {
    mockRenderMermaidSvg.mockReset();
    mockRenderMermaidSvg.mockResolvedValue('<svg></svg>');
  });

  it('renders mermaid diagram when cursor is outside the block', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const outsideOffset = text.indexOf('After') + 1;
    const outsidePosition = document.positionAt(outsideOffset);
    const selection = new Selection(outsidePosition, outsidePosition);
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as any));

    (decorator as any).activeEditor = editor;
    const applyMock = vi.fn();
    (decorator as any).mermaidCoordinator.mermaidDecorations = {
      apply: applyMock,
      clear: vi.fn(),
    };

    await (decorator as any).updateMermaidDiagrams(mermaidBlocks, text, document.version);

    expect(mockRenderMermaidSvg).toHaveBeenCalledTimes(1);
    expect(applyMock).toHaveBeenCalledTimes(1);
  });

  it('skips rendering when cursor is inside the block', async () => {
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text);
    const selection = new Selection(
      document.positionAt(0),
      document.positionAt(blockText.length)
    );
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as any));

    (decorator as any).activeEditor = editor;
    const applyMock = vi.fn();
    (decorator as any).mermaidCoordinator.mermaidDecorations = {
      apply: applyMock,
      clear: vi.fn(),
    };

    await (decorator as any).updateMermaidDiagrams(mermaidBlocks, text, document.version);

    expect(mockRenderMermaidSvg).not.toHaveBeenCalled();
    expect(applyMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates rendering for identical blocks during one update', async () => {
    const blockText2 = blockText;
    const text2 = `${blockText}\n\n${blockText2}\nAfter`;
    const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, text2);
    const outsideOffset = text2.indexOf('After') + 1;
    const outsidePosition = document.positionAt(outsideOffset);
    const selection = new Selection(outsidePosition, outsidePosition);
    const editor = new TextEditor(document, [selection]);
    const decorator = new Decorator(new MarkdownParseCache({} as any));

    (decorator as any).activeEditor = editor;
    const applyMock = vi.fn();
    (decorator as any).mermaidCoordinator.mermaidDecorations = {
      apply: applyMock,
      clear: vi.fn(),
    };

    const secondStart = blockText.length + 2; // "\n\n"
    const secondEnd = secondStart + blockText2.length;
    const blocks = [
      { startPos: 0, endPos: blockText.length, source: 'graph TD\n  A --> B', numLines: 2 },
      { startPos: secondStart, endPos: secondEnd, source: 'graph TD\n  A --> B', numLines: 2 },
    ];

    await (decorator as any).updateMermaidDiagrams(blocks, text2, document.version);

    expect(mockRenderMermaidSvg).toHaveBeenCalledTimes(1);
    expect(applyMock).toHaveBeenCalledTimes(1);
  });

  // The diagram image is a `before` attachment on a single line, and VS Code
  // only builds DOM for visible lines. Anchoring at the opening fence made the
  // whole diagram vanish as soon as the top of the block scrolled out of view.
  describe('re-anchoring while scrolling', () => {
    /** Renders a 20-line diagram with the given viewport, returning apply()'s arguments. */
    async function renderWithViewport(firstVisibleLine: number, lastVisibleLine: number) {
      const blockLines = ['```mermaid', 'graph TD', ...Array(17).fill('  A --> B'), '```'];
      const longBlock = blockLines.join('\n');
      const fullText = `${longBlock}\nAfter`;
      const document = new TextDocument(Uri.file('test.md'), 'markdown', 1, fullText);
      const outsidePosition = document.positionAt(fullText.indexOf('After') + 1);
      const viewport = new Range(
        new Position(firstVisibleLine, 0),
        new Position(lastVisibleLine, 0)
      );
      const editor = new TextEditor(
        document,
        [new Selection(outsidePosition, outsidePosition)],
        [viewport]
      );
      const decorator = new Decorator(new MarkdownParseCache({} as any));

      (decorator as any).activeEditor = editor;
      const applyMock = vi.fn();
      (decorator as any).mermaidCoordinator.mermaidDecorations = {
        apply: applyMock,
        clear: vi.fn(),
      };
      const sourceRanges: any[] = [];
      editor.setDecorations = vi.fn((type: any, ranges: any[]) => {
        if (type === (decorator as any).mermaidSourceDecorationType) {
          sourceRanges.push(...ranges);
        }
      });

      const blocks = [
        { startPos: 0, endPos: longBlock.length, source: 'graph TD\n  A --> B', numLines: 18 },
      ];
      await (decorator as any).updateMermaidDiagrams(blocks, fullText, document.version);

      const [, rangesByKey, , lineOffsetsByKey] = applyMock.mock.calls[0];
      const [key] = [...rangesByKey.keys()];
      return {
        anchorLine: rangesByKey.get(key)[0].start.line,
        lineOffset: lineOffsetsByKey.get(key),
        sourceRanges,
      };
    }

    it('anchors at the block start while the whole block is visible', async () => {
      const { anchorLine, lineOffset } = await renderWithViewport(0, 40);
      expect(anchorLine).toBe(0);
      expect(lineOffset).toBe(0);
    });

    it('re-anchors to the first visible line once the block top scrolls away', async () => {
      const { anchorLine, lineOffset } = await renderWithViewport(6, 40);
      expect(anchorLine).toBe(6);
      expect(lineOffset).toBe(6);
    });

    it('keeps the source hidden across the whole block regardless of the anchor', async () => {
      const { sourceRanges } = await renderWithViewport(6, 40);
      expect(sourceRanges).toHaveLength(1);
      expect(sourceRanges[0].start.line).toBe(0);
      expect(sourceRanges[0].end.line).toBe(19);
    });
  });
});
