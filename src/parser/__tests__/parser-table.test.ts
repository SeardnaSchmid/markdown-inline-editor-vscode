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

    it('emits one cell decoration per column for each non-separator row (three-column)', () => {
      const md = [
        '| aa | bb | cc |',
        '| -- | -- | -- |',
        '| 11 | 22 | 33 |',
        '| 44 | 55 | 66 |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      const cells =
        byType(result, 'tableCell').length + byType(result, 'tableCellNativePad').length;
      expect(cells).toBe(9);
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

    it('treats single emoji as wide so column reserves 2 columns', () => {
      // Header "Emoji" width 5; data cell holds one emoji (width 2).
      // Without wide-emoji support the data cell would be padded as if width 1.
      const md = '| Emoji |\n|-------|\n| \uD83D\uDE00 |';
      const result = parser.extractDecorations(md);
      const dataCell = byType(result, 'tableCell').find((c) =>
        c.replacement?.includes('\uD83D\uDE00'),
      );
      expect(dataCell).toBeDefined();
      // Replacement is "\u00A0" + content + "\u00A0".repeat(totalPad+1).
      // Without wide-emoji handling, totalPad would be header-1=4 → 6 trailing NBSP.
      // With wide-emoji handling, totalPad=header-2=3 → 5 trailing NBSP.
      const trailing = (dataCell!.replacement || '').match(/\u00A0+$/)?.[0] || '';
      expect(trailing.length).toBeLessThanOrEqual(5);
    });

    it('counts ZWJ-joined emoji sequences using single combined width', () => {
      // 👨‍👩‍👧 (man + ZWJ + woman + ZWJ + girl) renders as one wide glyph.
      // Without ZWJ handling we'd over-count to 6 (3 emoji × 2).
      const family = '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67';
      const md = `| Emoji |\n|-------|\n| ${family} |`;
      const result = parser.extractDecorations(md);
      const dataCell = byType(result, 'tableCell').find((c) =>
        c.replacement?.includes(family),
      );
      expect(dataCell).toBeDefined();
      // Total padding stays small; replacement length should be modest, not blown up.
      expect((dataCell!.replacement || '').length).toBeLessThanOrEqual(12);
    });
  });

  describe('inline formatting in cells', () => {
    it('uses native cell for whole-cell strong so source stays visible', () => {
      const md = '| A |\n|---|\n| **bold** |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pads = byType(result, 'tableCellNativePad');
      expect(cells.some((c) => c.cellStyle?.fontWeight === 'bold')).toBe(false);
      expect(cells.some((c) => c.replacement?.includes('**'))).toBe(false);
      expect(pads.length).toBeGreaterThanOrEqual(1);
    });

    it('uses native cell for whole-cell emphasis', () => {
      const md = '| A |\n|---|\n| *italic* |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pads = byType(result, 'tableCellNativePad');
      expect(cells.some((c) => c.cellStyle?.fontStyle === 'italic')).toBe(false);
      expect(pads.length).toBeGreaterThanOrEqual(1);
    });

    it('strips markers from width for synthetic cells (plain data row)', () => {
      const md = '| Header   |\n|----------|\n| plain    |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const dataCell = cells.find((c) => c.replacement!.includes('plain'));
      const headerCell = cells.find((c) => c.replacement!.includes('Header'));
      expect(dataCell).toBeDefined();
      expect(headerCell).toBeDefined();
      expect(dataCell!.replacement!.length).toBe(headerCell!.replacement!.length);
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
    it('uses native cell for link so markdown link styling can apply', () => {
      const md = '| Col |\n|-----|\n| [label](https://example.com) |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pads = byType(result, 'tableCellNativePad');
      expect(cells.some((c) => c.replacement?.includes('label'))).toBe(false);
      expect(pads.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('images in cells', () => {
    it('uses native cell for images and still emits a consistent pipe grid', () => {
      const md = '| Col |\n|-----|\n| ![t](https://example.com/x.png) |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCellNativePad').length).toBeGreaterThanOrEqual(1);
      expect(byType(result, 'tablePipe').length).toBeGreaterThan(0);
    });
  });

  describe('underscore delimiters in cells', () => {
    it('handles whole-cell ___…___ without throwing', () => {
      const md = '| Col |\n|-----|\n| ___x___ |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tablePipe').length).toBeGreaterThan(0);
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
    it('uses native cell for mixed formatting so markers are not in synthetic text', () => {
      const md = '| A |\n|---|\n| **bold** and plain |';
      const result = parser.extractDecorations(md);
      const cells = byType(result, 'tableCell');
      const pads = byType(result, 'tableCellNativePad');
      expect(cells.some((c) => c.replacement?.includes('**'))).toBe(false);
      expect(pads.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('rich vs plain table cells', () => {
    it('uses native pad for inline code cells', () => {
      const md = '| C |\n|---|\n| `x` |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCellNativePad').length).toBe(1);
      expect(byType(result, 'tableCell').length).toBe(1);
    });

    it('uses synthetic tableCell for plain cells only', () => {
      const md = '| P |\n|---|\n| plain |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCellNativePad').length).toBe(0);
      const cells = byType(result, 'tableCell');
      expect(cells.length).toBeGreaterThanOrEqual(2);
      cells.forEach((c) => {
        expect(c.replacement!.startsWith('\u00A0')).toBe(true);
      });
    });
  });

  describe('tableCellWidthCh (synthetic cell grid)', () => {
    it('sets tableCellWidthCh on every synthetic cell for CJK and emoji columns', () => {
      const md = [
        '| Name | CJK | Emoji |',
        '| ---- | ---- | ----- |',
        '| AB | 你好 | 😀 |',
        '| CD | 世界 | 🚀 |',
      ].join('\n');
      const result = parser.extractDecorations(md);
      const synthetic = byType(result, 'tableCell').filter((c) => c.tableCellWidthCh !== undefined);
      expect(synthetic.length).toBeGreaterThanOrEqual(8);
      synthetic.forEach((c) => {
        expect(typeof c.tableCellWidthCh).toBe('number');
        expect(c.tableCellWidthCh!).toBeGreaterThan(0);
      });
    });

    it('uses native pad for mixed emphasis in a cell without throwing', () => {
      const md = '| Col |\n|-----|\n| a *i* z |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCellNativePad').length).toBeGreaterThanOrEqual(1);
      expect(byType(result, 'tablePipe').length).toBeGreaterThan(0);
    });

    it('uses native pad for mixed underscore emphasis in a cell', () => {
      const md = '| Col |\n|-----|\n| a _i_ z |';
      const result = parser.extractDecorations(md);
      expect(byType(result, 'tableCellNativePad').length).toBeGreaterThanOrEqual(1);
    });
  });
});
