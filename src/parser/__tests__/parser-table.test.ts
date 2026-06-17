import { MarkdownParser, DecorationRange } from '../../parser';
import { config } from '../../config';

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

    it('should create tableCell decorations with padded replacement', () => {
      const md = '| Name | Age |\n|------|-----|\n| Jo   | 5   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(4);
      cells.forEach((c) => {
        expect(c.replacement).toBeDefined();
        // Each cell should start and end with non-breaking space
        expect(c.replacement!.startsWith('\u00A0')).toBe(true);
        expect(c.replacement!.endsWith('\u00A0')).toBe(true);
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

    it('should left-align cells by default (pad right)', () => {
      const md = '| Foo | Bar |\n|-----|-----|\n| x   | y   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      // Default alignment: content starts after one NBSP
      const dataCell = cells.find((c) => c.replacement!.includes('x'));
      expect(dataCell).toBeDefined();
      // Left-aligned: starts with single NBSP then content
      expect(dataCell!.replacement!.indexOf('x')).toBe(1);
    });

    it('should right-align cells when column uses ---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      // Find a data row cell for the right-aligned column (column index 2, content "c")
      const rightCell = cells.find((c) => c.replacement!.includes('c'));
      expect(rightCell).toBeDefined();
      // Right-aligned: content should end with single NBSP
      expect(rightCell!.replacement!.endsWith('c\u00A0')).toBe(true);
      // Should have leading padding
      const leadingSpaces = rightCell!.replacement!.length - rightCell!.replacement!.trimStart().length;
      expect(leadingSpaces).toBeGreaterThanOrEqual(1);
    });

    it('should center-align cells when column uses :---:', () => {
      const result = parser.extractDecorations(alignedTable);
      const cells = byType(result, 'tableCell');
      // Find a data row cell for the center-aligned column (column index 1, content "b")
      const centerCell = cells.find((c) => c.replacement!.includes('b'));
      expect(centerCell).toBeDefined();
      // Center-aligned: should have padding on both sides
      const content = centerCell!.replacement!;
      const trimmed = content.replace(/\u00A0/g, '').trim();
      const beforeContent = content.indexOf(trimmed);
      const afterContent = content.length - beforeContent - trimmed.length;
      // Both sides should have at least 1 char of padding
      expect(beforeContent).toBeGreaterThanOrEqual(1);
      expect(afterContent).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CJK wide characters', () => {
    it('should account for CJK double-width in column padding', () => {
      const md = '| Name | CJK  |\n|------|------|\n| AB   | \u4F60\u597D   |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      // All cells should have replacement text
      cells.forEach((c) => {
        expect(c.replacement).toBeDefined();
      });
    });

    describe('when tables.cjkWidthRatio is configured', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should use the configured ratio for visual column width calculation', () => {
        const md = '| A |\n|---|\n| \u3042\u3042 |';
        const cjkWidthRatio = vi.spyOn(config.tables, 'cjkWidthRatio');

        cjkWidthRatio.mockReturnValue(2);
        const twoColumnCells = byType(parser.extractDecorations(md), 'tableCell');
        const twoColumnHeader = twoColumnCells.find((c) => c.replacement?.includes('A'));
        expect(twoColumnHeader).toBeDefined();
        expect(twoColumnHeader!.replacement!.length).toBe(6);

        cjkWidthRatio.mockReturnValue(3);
        const threeColumnCells = byType(parser.extractDecorations(md), 'tableCell');
        const threeColumnHeader = threeColumnCells.find((c) => c.replacement?.includes('A'));
        expect(threeColumnHeader).toBeDefined();
        expect(threeColumnHeader!.replacement!.length).toBe(8);
      });
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
      // "bold" (4 chars) should be padded relative to "Header" (6 chars),
      // not "**bold**" (8 chars)
      const boldCell = cells.find((c) => c.replacement!.includes('bold'));
      expect(boldCell).toBeDefined();
      const headerCell = cells.find((c) => c.replacement!.includes('Header'));
      expect(headerCell).toBeDefined();
      // Both replacements should be same total length (aligned columns)
      expect(boldCell!.replacement!.length).toBe(headerCell!.replacement!.length);
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
