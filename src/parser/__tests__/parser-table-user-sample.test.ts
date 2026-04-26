import { MarkdownParser } from '../../parser';

describe('MarkdownParser - user feature table sample', () => {
  const md = [
    '| Feature | Implementation Approach | Complexity | Dependencies | Estimated Effort |',
    '|---------|------------------------|------------|--------------|------------------|',
    '| **Autolinks** | Detect `<https://...>` and `<email@example.com>`, style as links, hide brackets | Low | None (parser enhancement) | Low (1 week) |',
    '| **Mermaid Diagrams** | Detect ` ```mermaid` blocks, render on hover using hover provider | Moderate | Rendering solution (to be determined) | Medium (2-3 weeks) |',
    '| **LaTeX/Math** | Detect `$...$` and `$$...$$`, render on hover using hover provider | Moderate | Math rendering solution (to be determined) | Medium (2-3 weeks) |',
    '',
  ].join('\n');

  it('emits synthetic cells for plain columns and native pads for rich cells', async () => {
    const parser = await MarkdownParser.create();
    const decs = parser.extractDecorations(md);
    const tableCells = decs.filter((d) => d.type === 'tableCell');
    const nativePads = decs.filter((d) => d.type === 'tableCellNativePad');
    const tablePipes = decs.filter((d) => d.type === 'tablePipe');
    const contentTableLines = md
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|') && /[A-Za-z0-9`]/.test(l));
    const columnCount = contentTableLines[0]
      .split('|')
      .filter((segment) => segment.trim().length > 0).length;
    const expectedCellDecorations = contentTableLines.length * columnCount;
    expect(tableCells.length + nativePads.length).toBe(expectedCellDecorations);
    expect(nativePads.length).toBeGreaterThan(0);
    expect(tablePipes.length).toBeGreaterThanOrEqual(24);
    tableCells.forEach((c) => {
      expect(c.replacement).toBeDefined();
      expect(c.replacement!.startsWith('\u00A0')).toBe(true);
      expect(c.replacement!.endsWith('\u00A0')).toBe(true);
    });
  });

  it('pads native whole-cell bold using visible ** markers so pipes align', async () => {
    const parser = await MarkdownParser.create();
    const md = '| A |\n|---|\n| **BB** |';
    const decs = parser.extractDecorations(md);
    const pads = decs.filter((d) => d.type === 'tableCellNativePad');
    const cells = decs.filter((d) => d.type === 'tableCell');
    // Whole-cell bold stays native (see parser-table); width must use ** markers.
    expect(pads.length).toBeGreaterThanOrEqual(1);
    expect(cells.some((c) => c.replacement?.includes('BB'))).toBe(false);
    // Cell range starts at the first char inside the cell (may be a space before `**`).
    const dataPad = pads[pads.length - 1];
    expect(dataPad).toBeDefined();
    // Trailing pad is merged into the closing pipe (not cell `after`), so │ sits right of NBSP.
    const closingPipe = decs.find(
      (d) => d.type === 'tablePipe' && d.startPos === dataPad!.endPos,
    );
    expect(closingPipe?.replacementPrefix).toBe('\u00A0');
  });
});
