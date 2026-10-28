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

    it('should treat Hangul syllables as double-width like other CJK', () => {
      const hangul = parser.extractDecorations('| A |\n|---|\n| \uD55C\uAE00 |');
      const han = parser.extractDecorations('| A |\n|---|\n| \u4F60\u597D |');
      const hangulCell = byType(hangul, 'tableCell').find((c) =>
        c.replacement!.includes('\uD55C\uAE00')
      );
      const hanCell = byType(han, 'tableCell').find((c) => c.replacement!.includes('\u4F60\u597D'));
      expect(hangulCell).toBeDefined();
      expect(hanCell).toBeDefined();
      // Two Hangul syllables span the same columns as two Han characters,
      // so both cells must be padded identically.
      expect(hangulCell!.replacement!.length).toBe(hanCell!.replacement!.length);
    });

    it('should treat fullwidth forms as double-width', () => {
      const fullwidth = parser.extractDecorations('| A |\n|---|\n| \uFF21\uFF22 |');
      const han = parser.extractDecorations('| A |\n|---|\n| \u4F60\u597D |');
      const fullwidthCell = byType(fullwidth, 'tableCell').find((c) =>
        c.replacement!.includes('\uFF21\uFF22')
      );
      const hanCell = byType(han, 'tableCell').find((c) => c.replacement!.includes('\u4F60\u597D'));
      expect(fullwidthCell).toBeDefined();
      expect(hanCell).toBeDefined();
      expect(fullwidthCell!.replacement!.length).toBe(hanCell!.replacement!.length);
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

  describe('header highlighting', () => {
    const table = '| **Name** | Value |\n|---|---|\n| a | 1 |';
    const headerColor = 'var(--vscode-textLink-foreground)';

    it('colors header cells and keeps their detected style by default', () => {
      const cells = byType(parser.extractDecorations(table), 'tableCell');
      expect(cells[0].cellStyle).toEqual({ fontWeight: 'bold', color: headerColor });
      expect(cells[1].cellStyle).toEqual({ color: headerColor });
    });

    it('does not color body cells', () => {
      const cells = byType(parser.extractDecorations(table), 'tableCell');
      expect(cells[2].cellStyle).toBeUndefined();
      expect(cells[3].cellStyle).toBeUndefined();
    });

    it('leaves header cells uncolored when disabled', () => {
      const cells = withConfig({ 'tables.highlightHeaders': false }, () =>
        byType(parser.extractDecorations(table), 'tableCell'),
      );
      expect(cells[0].cellStyle).toEqual({ fontWeight: 'bold' });
      expect(cells[1].cellStyle).toBeUndefined();
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

    it('should show raw syntax when cell starts and ends with formatting delimiters but contains mixed content', () => {
      const md = '| Col |\n|---|\n| **A** and **B** |\n| *A* and *B* |\n| `A` and `B` |\n| ~~A~~ and ~~B~~ |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');

      const boldCell = cells.find((c) => c.replacement!.includes('**A**'));
      expect(boldCell).toBeDefined();
      expect(boldCell!.replacement).toContain('**');
      expect(boldCell!.cellStyle).toBeUndefined();

      const italicCell = cells.find((c) => c.replacement!.includes('*A*'));
      expect(italicCell).toBeDefined();
      expect(italicCell!.replacement).toContain('*');
      expect(italicCell!.cellStyle).toBeUndefined();

      const codeCell = cells.find((c) => c.replacement!.includes('`A`'));
      expect(codeCell).toBeDefined();
      expect(codeCell!.replacement).toContain('`');
      expect(codeCell!.cellStyle).toBeUndefined();

      const strikeCell = cells.find((c) => c.replacement!.includes('~~A~~'));
      expect(strikeCell).toBeDefined();
      expect(strikeCell!.replacement).toContain('~~');
      expect(strikeCell!.cellStyle).toBeUndefined();
    });

    it('should not treat delimiter runs with inner whitespace as formatted cells', () => {
      const md = '| Col |\n|---|\n| ** Not valid ** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const cell = cells.find((c) => c.replacement!.includes('Not valid'));
      expect(cell).toBeDefined();
      expect(cell!.cellStyle).toBeUndefined();
    });

    it('should preserve backticks for inline code cells', () => {
      const md = '| Col |\n|---|\n| `code only` |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const cell = cells.find((c) => c.replacement!.includes('code only'));
      expect(cell).toBeDefined();
      expect(cell!.replacement).toContain('`code only`');
      expect(cell!.cellStyle).toBeUndefined();
    });

    it('should show raw syntax for nested partial formatting within bold or italic', () => {
      const md = '| Col |\n|---|\n| **Bold and _italic_ inside** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const cell = cells.find((c) => c.replacement!.includes('italic'));
      expect(cell).toBeDefined();
      expect(cell!.replacement).toContain('**');
      expect(cell!.replacement).toContain('_');
      expect(cell!.cellStyle).toBeUndefined();
    });

    it('should style whole-cell bold and italic when fully wrapped with combined delimiters', () => {
      const md = '| Col |\n|---|\n| ***Bold and Italic*** |\n| **_Bold and Italic_** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const cellsWithBoldItalic = cells.filter((c) => c.cellStyle?.fontWeight === 'bold' && c.cellStyle?.fontStyle === 'italic');
      expect(cellsWithBoldItalic.length).toBe(2);
    });
  });
});
