import { MarkdownParser, DecorationRange } from '../../parser';
import { workspace } from '../../test/__mocks__/vscode';

describe('MarkdownParser - Tables', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  function byType(decs: DecorationRange[], type: string) {
    return decs.filter((d) => d.type === type);
  }

  /** Runs `fn` with the given `markdownInlineEditor.*` settings in effect. */
  function withConfig<T>(overrides: Record<string, unknown>, fn: () => T): T {
    const original = (workspace as any).getConfiguration;
    (workspace as any).getConfiguration = () => ({
      get: (key: string, defaultValue: unknown) =>
        key in overrides ? overrides[key] : defaultValue,
    });
    try {
      return fn();
    } finally {
      (workspace as any).getConfiguration = original;
    }
  }

  /**
   * Turns on preview style for the enclosing describe block. Tables render in `grid`
   * style by default, so every preview expectation has to opt in.
   */
  function usePreviewStyle(extraOverrides: Record<string, unknown> = {}) {
    let original: unknown;
    beforeEach(() => {
      original = (workspace as any).getConfiguration;
      const overrides = { 'tables.style': 'preview', ...extraOverrides };
      (workspace as any).getConfiguration = () => ({
        get: (key: string, defaultValue: unknown) =>
          key in overrides ? overrides[key] : defaultValue,
      });
    });
    afterEach(() => {
      (workspace as any).getConfiguration = original;
    });
  }

  describe('basic table rendering (preview style)', () => {
    usePreviewStyle();

    it('should hide pipe characters in preview style', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      const pipes = byType(result, 'tablePipe');
      // Header and data row, 3 pipes each; separator pipes are reported separately
      expect(pipes.length).toBeGreaterThanOrEqual(6);
      pipes.forEach((p) => {
        expect(p.replacement).toBe('');
      });
    });

    it('should create tableCell decorations with unpadded text and a box width', () => {
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(4);
      cells.forEach((c) => {
        expect(c.replacement).toBeDefined();
        // Preview style lays cells out with CSS, so no padding is baked into the text
        expect(c.replacement).toBe(c.replacement!.trim());
        expect(c.boxWidth).toBeGreaterThan(0);
      });
    });

    it('should give every cell in a column the same box width', () => {
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const nameColumn = cells.filter((c) => ['Name', 'Jo'].includes(c.replacement!));
      expect(nameColumn).toHaveLength(2);
      expect(nameColumn[0].boxWidth).toBe(nameColumn[1].boxWidth);
    });

    it('should mark header cells and put row separators on data rows only', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const headerCells = cells.filter((c) => c.isHeaderCell);
      const dataCells = cells.filter((c) => !c.isHeaderCell);
      expect(headerCells).toHaveLength(2);
      expect(dataCells).toHaveLength(2);
      expect(headerCells.every((c) => c.drawRowSeparator !== true)).toBe(true);
      expect(dataCells.every((c) => c.drawRowSeparator === true)).toBe(true);
    });

    it('should replace the separator row with a single rule spanning the table', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      const rules = byType(result, 'tableRule');
      expect(rules).toHaveLength(1);
      expect(byType(result, 'tableSeparatorDash')).toHaveLength(0);
      expect(byType(result, 'tableSeparatorPipe')).toHaveLength(0);

      const headerWidth = byType(result, 'tableCell')
        .filter((c) => c.isHeaderCell)
        .reduce((total, c) => total + c.boxWidth!, 0);
      expect(rules[0].boxWidth).toBe(headerWidth);
    });

    it('should omit row separators when they are disabled', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = withConfig({ 'tables.style': 'preview', 'tables.rowSeparators': false }, () =>
        parser.extractDecorations(md)
      );
      expect(byType(result, 'tableCell').every((c) => c.drawRowSeparator !== true)).toBe(true);
      // The header rule is independent of the row separators
      expect(byType(result, 'tableRule')).toHaveLength(1);
    });
  });

  describe('column alignment (preview style)', () => {
    usePreviewStyle();

    const alignedTable = [
      '| Left | Center | Right |',
      '|:-----|:------:|------:|',
      '| a    |   b    |     c |',
    ].join('\n');

    it('should left-align cells by default', () => {
      const md = '| Foo | Bar |\n|-----|-----|\n| x   | y   |';
      const result = parser.extractDecorations(md);
      const dataCell = byType(result, 'tableCell').find((c) => c.replacement === 'x');
      expect(dataCell).toBeDefined();
      expect(dataCell!.cellAlign).toBe('left');
    });

    it('should right-align cells when column uses ---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const rightCell = byType(result, 'tableCell').find((c) => c.replacement === 'c');
      expect(rightCell).toBeDefined();
      expect(rightCell!.cellAlign).toBe('right');
    });

    it('should center-align cells when column uses :---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const centerCell = byType(result, 'tableCell').find((c) => c.replacement === 'b');
      expect(centerCell).toBeDefined();
      expect(centerCell!.cellAlign).toBe('center');
    });
  });

  describe('CJK wide characters (preview style)', () => {
    usePreviewStyle();

    it('should size a CJK column using the configured width ratio', () => {
      const md = '| Name | CJK  |\n|------|------|\n| AB   | 你好   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      cells.forEach((c) => {
        expect(c.replacement).toBeDefined();
      });
      // Header "CJK" is 3 wide, the data cell is 2 CJK chars = 4 wide at ratio 2,
      // so the column box is 4 plus one character of padding on either side.
      const cjkColumn = cells.filter((c) => ['CJK', '你好'].includes(c.replacement!));
      expect(cjkColumn).toHaveLength(2);
      cjkColumn.forEach((c) => expect(c.boxWidth).toBe(6));
    });

    it('should treat fullwidth parentheses as wide characters', () => {
      // Fullwidth （） are common in Japanese text and are two cells wide
      const md = '| A |\n|---|\n| （x） |';
      const result = parser.extractDecorations(md);
      const dataCell = byType(result, 'tableCell').find((c) => !c.isHeaderCell);
      expect(dataCell).toBeDefined();
      // 2 fullwidth parens (2 each) + "x" = 5, plus padding on either side
      expect(dataCell!.boxWidth).toBe(7);
    });

    it('should honour a custom cjkWidthRatio', () => {
      const md = '| A |\n|---|\n| あいう |';
      const wide = withConfig({ 'tables.style': 'preview', 'tables.cjkWidthRatio': 2 }, () =>
        parser.extractDecorations(md)
      );
      const narrow = withConfig({ 'tables.style': 'preview', 'tables.cjkWidthRatio': 1 }, () =>
        parser.extractDecorations(md)
      );
      const boxWidthOf = (result: DecorationRange[]) =>
        byType(result, 'tableCell').find((c) => !c.isHeaderCell)!.boxWidth;
      expect(boxWidthOf(wide)).toBe(8); // 3 chars × 2 + 2 padding
      expect(boxWidthOf(narrow)).toBe(5); // 3 chars × 1 + 2 padding
    });

    it('should clamp columns to maxColumnWidth', () => {
      const md = '| Header |\n|--------|\n| ' + 'x'.repeat(80) + ' |';
      const result = withConfig({ 'tables.style': 'preview', 'tables.maxColumnWidth': 10 }, () =>
        parser.extractDecorations(md)
      );
      byType(result, 'tableCell').forEach((c) => {
        // 10 character widths of content plus the padding on either side
        expect(c.boxWidth).toBe(12);
      });
    });
  });

  describe('inline formatting in cells', () => {
    usePreviewStyle();

    it('should detect bold cell style', () => {
      const md = '| A |\n|---|\n| **bold** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const boldCell = cells.find((c) => c.cellStyle?.fontWeight === 'bold');
      expect(boldCell).toBeDefined();
      // replacement should not contain ** markers
      expect(boldCell!.replacement).not.toContain('**');
      expect(boldCell!.replacement).toContain('bold');
    });

    it('should detect italic cell style', () => {
      const md = '| A |\n|---|\n| *italic* |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const italicCell = cells.find((c) => c.cellStyle?.fontStyle === 'italic');
      expect(italicCell).toBeDefined();
    });

    it('should strip markers from width calculation', () => {
      const md = '| Header   |\n|----------|\n| **bold** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      // "bold" (4 chars) sizes the column against "Header" (6 chars),
      // not against "**bold**" (8 chars)
      const boldCell = cells.find((c) => c.replacement!.includes('bold'));
      expect(boldCell).toBeDefined();
      const headerCell = cells.find((c) => c.replacement!.includes('Header'));
      expect(headerCell).toBeDefined();
      expect(boldCell!.boxWidth).toBe(headerCell!.boxWidth);
      expect(headerCell!.boxWidth).toBe(8); // "Header" is 6 wide plus padding
    });
  });

  describe('edge cases', () => {
    it('should handle empty cells', () => {
      const md = '| A |   |\n|---|---|\n|   | B |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle single-column table', () => {
      const md = '| A |\n|---|\n| B |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(2);
    });

    it('should not decorate tables inside code blocks', () => {
      const md = '```\n| A | B |\n|---|---|\n| 1 | 2 |\n```';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCell')).toHaveLength(0);
      expect(byType(result, 'tableRule')).toHaveLength(0);
    });
  });

  describe('outer-pipe-less tables (preview style)', () => {
    usePreviewStyle();

    it('should render outer-pipe-less table when it starts at document offset 0', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pipes = byType(result, 'tablePipe');
      expect(cells.length).toBeGreaterThanOrEqual(4);
      expect(cells.every((c) => c.startPos >= 0 && c.endPos > c.startPos)).toBe(true);
      pipes.forEach((p) => {
        expect(p.startPos).toBeGreaterThanOrEqual(0);
        expect(p.replacement).toBe('');
      });
    });

    it('should render cells when table has no outer pipes', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(4);
    });

    it('should render a rule for the separator row of an outer-pipe-less table', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableRule')).toHaveLength(1);
    });
  });

  describe('grid style (the default)', () => {
    it('should replace pipes with box-drawing characters', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      const pipes = byType(result, 'tablePipe');
      expect(pipes.length).toBeGreaterThanOrEqual(6);
      pipes.forEach((p) => {
        expect(p.replacement).toBe('│');
      });
    });

    it('should pad cells with non-breaking spaces instead of using CSS boxes', () => {
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(4);
      cells.forEach((c) => {
        expect(c.replacement!.startsWith(' ')).toBe(true);
        expect(c.replacement!.endsWith(' ')).toBe(true);
        expect(c.boxWidth).toBeUndefined();
      });
    });

    it('should keep separator pipes and dashes and emit no rule', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableSeparatorPipe').length).toBeGreaterThanOrEqual(3);
      expect(byType(result, 'tableSeparatorDash').length).toBeGreaterThanOrEqual(2);
      expect(byType(result, 'tableRule')).toHaveLength(0);
    });

    it('should pad according to column alignment', () => {
      const alignedTable = [
        '| Left | Center | Right |',
        '|:-----|:------:|------:|',
        '| a    |   b    |     c |',
      ].join('\n');
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      const rightCell = cells.find((c) => c.replacement!.includes('c'));
      expect(rightCell!.replacement!.endsWith('c ')).toBe(true);
    });
  });

  describe('links in cells', () => {
    it('should include link label text in cell replacement', () => {
      const md = '| Col |\n|-----|\n| [label](https://example.com) |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const dataCell = cells.find((c) => c.replacement?.includes('label'));
      expect(dataCell).toBeDefined();
      expect(dataCell!.replacement).not.toContain('https://');
    });
  });

  describe('snake_case and literal character preservation', () => {
    it('should not strip underscores from snake_case cell content', () => {
      const md = '| Field |\n|-------|\n| snake_case |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const snakeCell = cells.find((c) => c.replacement!.includes('snake_case'));
      expect(snakeCell).toBeDefined();
    });

    it('should not strip asterisks from arithmetic expressions', () => {
      const md = '| Expr |\n|------|\n| 100*200 |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const exprCell = cells.find((c) => c.replacement!.includes('100'));
      expect(exprCell).toBeDefined();
    });
  });

  describe('mixed formatting fallback', () => {
    it('should show raw syntax for mixed formatting cells', () => {
      const md = '| A |\n|---|\n| **bold** and plain |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const mixedCell = cells.find((c) => c.replacement!.includes('bold'));
      expect(mixedCell).toBeDefined();
      // Mixed formatting should show raw markdown syntax
      expect(mixedCell!.replacement).toContain('**');
      // Should NOT have cellStyle since it's mixed
      expect(mixedCell!.cellStyle).toBeUndefined();
    });
  });
});
