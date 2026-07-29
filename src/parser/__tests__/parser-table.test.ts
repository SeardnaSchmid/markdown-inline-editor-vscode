import { MarkdownParser, DecorationRange } from '../../parser';

describe('MarkdownParser - Tables', () => {
  let parser: MarkdownParser;

  beforeEach(async () => {
    parser = await MarkdownParser.create();
  });

  function byType(decs: DecorationRange[], type: string) {
    return decs.filter((d) => d.type === type);
  }

  describe('basic table rendering', () => {
    it('should create tablePipe decorations for pipe characters', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      const pipes = byType(result, 'tablePipe');
      // 3 rows × 3 pipes each = 9, minus separator pipes
      expect(pipes.length).toBeGreaterThanOrEqual(6);
      pipes.forEach((p) => {
        expect(p.replacement).toBe('\u2502');
      });
    });

    it('should replace cells with their content only, unpadded', () => {
      // Padding lives in the cell box (CSS), not in the replacement string, so
      // that column width no longer depends on how wide the font draws glyphs.
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.map((c) => c.replacement)).toEqual(['Name', 'Age', 'Jo', '5']);
    });

    it('should give every cell in a column the same box width', () => {
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      // Column 0 holds "Name" (4) and "Jo" (2) -> 4 content + 2 padding columns.
      expect(cells[0].cellWidth).toBe(6);
      expect(cells[2].cellWidth).toBe(6);
      // Column 1 falls back to the 3-column minimum: "Age" (3) + 2 padding.
      expect(cells[1].cellWidth).toBe(5);
      expect(cells[3].cellWidth).toBe(5);
    });

    it('should give the separator segments the same box width as their column', () => {
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const dashes = byType(result, 'tableSeparatorDash');
      expect(dashes.map((d) => d.cellWidth)).toEqual([cells[0].cellWidth, cells[1].cellWidth]);
      dashes.forEach((d) => {
        expect(d.replacement!.length).toBe(d.cellWidth);
      });
    });

    it('should keep empty cells non-empty so the column does not collapse', () => {
      // A pseudo-element with empty content renders no box, which would drop
      // the column from that row and break the grid.
      const md = '| A |   |\n|---|---|\n|   | B |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      cells.forEach((c) => {
        expect(c.replacement).toBeTruthy();
      });
    });

    it('should create separator decorations', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parser.extractDecorations(md);
      const sepPipes = byType(result, 'tableSeparatorPipe');
      const sepDashes = byType(result, 'tableSeparatorDash');
      expect(sepPipes.length).toBeGreaterThanOrEqual(3);
      expect(sepDashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('column alignment', () => {
    const alignedTable = [
      '| Left | Center | Right |',
      '|:-----|:------:|------:|',
      '| a    |   b    |     c |',
    ].join('\n');

    it('should left-align cells by default', () => {
      const md = '| Foo | Bar |\n|-----|-----|\n| x   | y   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const dataCell = cells.find((c) => c.replacement === 'x');
      expect(dataCell).toBeDefined();
      expect(dataCell!.cellAlign).toBe('left');
    });

    it('should right-align cells when column uses ---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      const rightCell = cells.find((c) => c.replacement === 'c');
      expect(rightCell).toBeDefined();
      expect(rightCell!.cellAlign).toBe('right');
    });

    it('should center-align cells when column uses :---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      const centerCell = cells.find((c) => c.replacement === 'b');
      expect(centerCell).toBeDefined();
      expect(centerCell!.cellAlign).toBe('center');
    });

    it('should apply the column alignment to header cells too', () => {
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      expect(cells.find((c) => c.replacement === 'Left')!.cellAlign).toBe('left');
      expect(cells.find((c) => c.replacement === 'Center')!.cellAlign).toBe('center');
      expect(cells.find((c) => c.replacement === 'Right')!.cellAlign).toBe('right');
    });
  });

  describe('CJK and other wide characters', () => {
    it('should size a CJK column at exactly two columns per character', () => {
      // Regression: the old measurement added ceil(cjkCount * 0.25) on top of
      // 2-per-character. That surcharge landed in the column width, widening
      // every *other* cell in the column while leaving the CJK cell at its
      // natural size - inverting the alignment it was meant to fix.
      const md = '| Name | CJK |\n|---|---|\n| AB | \u4F60\u597D\u4E16\u754C |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const cjkCell = cells.find((c) => c.replacement === '\u4F60\u597D\u4E16\u754C');
      const headerCell = cells.find((c) => c.replacement === 'CJK');
      // 4 CJK characters = 8 columns, + 2 padding columns. No surcharge.
      expect(cjkCell!.cellWidth).toBe(10);
      expect(headerCell!.cellWidth).toBe(10);
    });

    it('should size Hangul columns as wide', () => {
      // Regression: U+AC00-U+D7A3 sat above the old 0x2E80-0x9FFF cutoff.
      const md = '| A |\n|---|\n| \uD55C\uAD6D\uC5B4 |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.find((c) => c.replacement === '\uD55C\uAD6D\uC5B4')!.cellWidth).toBe(8);
    });

    it('should size fullwidth forms as wide', () => {
      // Regression: U+FF01-U+FF60 was outside every old range.
      const md = '| A |\n|---|\n| \uFF11\uFF12\uFF13 |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.find((c) => c.replacement === '\uFF11\uFF12\uFF13')!.cellWidth).toBe(8);
    });

    it('should size emoji as wide', () => {
      const md = '| Status |\n|---|\n| \u2705 ok |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      // "\u2705 ok" = 2 + 1 + 2 = 5 columns, wider than the 6-column "Status"
      // header only once the emoji counts as 2.
      expect(cells.find((c) => c.replacement === 'Status')!.cellWidth).toBe(8);
    });

    it('should give every cell in a mixed-script column the same width', () => {
      const md = '| \u540D\u79F0 | V |\n|---|---|\n| \u4F60\u597D\u4E16\u754C | 1 |\n| abc | 22 |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const firstColumn = [cells[0], cells[2], cells[4]];
      const widths = new Set(firstColumn.map((c) => c.cellWidth));
      expect(widths.size).toBe(1);
      expect([...widths][0]).toBe(10);
    });
  });

  describe('inline formatting in cells', () => {
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
      // Width follows "bold" (4), not "**bold**" (8), so the column is sized
      // by the longest *rendered* content: "Header" (6) + 2 padding columns.
      const boldCell = cells.find((c) => c.replacement === 'bold');
      const headerCell = cells.find((c) => c.replacement === 'Header');
      expect(boldCell).toBeDefined();
      expect(headerCell).toBeDefined();
      expect(boldCell!.cellWidth).toBe(8);
      expect(boldCell!.cellWidth).toBe(headerCell!.cellWidth);
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
  });

  describe('outer-pipe-less tables', () => {
    it('should render outer-pipe-less table when it starts at document offset 0', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pipes = byType(result, 'tablePipe');
      expect(cells.length).toBeGreaterThanOrEqual(4);
      expect(cells.every((c) => c.startPos >= 0 && c.endPos > c.startPos)).toBe(true);
      pipes.forEach((p) => {
        expect(p.startPos).toBeGreaterThanOrEqual(0);
        expect(p.replacement).toBe('\u2502');
      });
    });

    it('should render cells when table has no outer pipes', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(4);
    });

    it('should render separator for outer-pipe-less table', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const sepDashes = byType(result, 'tableSeparatorDash');
      expect(sepDashes.length).toBeGreaterThanOrEqual(2);
    });

    it('should not create pipe decorations for virtual boundary positions', () => {
      const md = 'A | B\n---|---\n1 | 2';
      const result = parser.extractDecorations(md);
      const pipes = byType(result, 'tablePipe');
      // Virtual boundaries should not be decorated; all real pipes get │
      pipes.forEach((p) => {
        expect(p.replacement).toBe('\u2502');
      });
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
