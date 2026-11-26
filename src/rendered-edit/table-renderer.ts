import { Range, ThemeColor, type DecorationOptions, type TextEditor } from 'vscode';
import { config } from '../config';
import {
  CELL_PADDING_CH,
  findPipePositions,
  measureTextWidth,
  normalizePipePositions,
  trimLineEnd,
} from '../parser/tables';
import type { DecorationRange, DecorationType } from '../parser';

export interface RenderedEditTableCellMeta {
  kind: 'cell';
  boxWidth?: number;
  cellAlign?: 'left' | 'center' | 'right';
  isHeaderCell?: boolean;
  replacement?: string;
}

export interface RenderedEditTableRuleMeta {
  kind: 'rule';
  boxWidth?: number;
}

export interface RenderedEditTablePipeMeta {
  kind: 'pipe' | 'separatorPipe' | 'separatorDash';
  replacement: string;
}

export type RenderedEditTableMeta =
  | RenderedEditTableCellMeta
  | RenderedEditTableRuleMeta
  | RenderedEditTablePipeMeta;

export type RenderedEditTableOption = DecorationOptions & {
  renderedEditTableMeta?: RenderedEditTableMeta;
};

interface Interval {
  start: number;
  end: number;
}

interface ParsedCellInfo {
  range: Range;
  line: number;
  cellStart: number;
  cellEnd: number;
  trimStart: number;
  trimEnd: number;
  visibleWidth: number;
  meta?: RenderedEditTableCellMeta;
}

interface ParsedTableGroup {
  lines: number[];
  cellsByLine: Map<number, ParsedCellInfo[]>;
  sepLine: number | undefined;
}

/**
 * Extracts text inside [startOff, endOff) excluding ONLY zero-width (font-size:0) hidden intervals.
 * Transparent markers (inline code backticks) still occupy 1 character column on screen and
 * therefore remain counted in the measured visible width.
 */
function extractZeroWidthStrippedSlice(
  text: string,
  startOff: number,
  endOff: number,
  zeroWidthIntervals: readonly Interval[]
): string {
  if (startOff >= endOff) {
    return '';
  }
  let out = '';
  let cur = startOff;
  for (const h of zeroWidthIntervals) {
    if (h.end <= cur) continue;
    if (h.start >= endOff) break;
    if (h.start > cur) {
      out += text.slice(cur, Math.min(h.start, endOff));
    }
    cur = Math.max(cur, Math.min(h.end, endOff));
  }
  if (cur < endOff) {
    out += text.slice(cur, endOff);
  }
  return out;
}

function computeCellPadding(
  colWidth: number,
  visibleWidth: number,
  align: 'left' | 'center' | 'right'
): { leftCh: number; rightCh: number } {
  const padTotal = Math.max(0, colWidth - visibleWidth);
  if (align === 'right') {
    return { leftCh: padTotal + CELL_PADDING_CH, rightCh: CELL_PADDING_CH };
  }
  if (align === 'center') {
    const half = Math.floor(padTotal / 2);
    return { leftCh: half + CELL_PADDING_CH, rightCh: padTotal - half + CELL_PADDING_CH };
  }
  return { leftCh: CELL_PADDING_CH, rightCh: padTotal + CELL_PADDING_CH };
}

/**
 * Parses column alignments (`:---`, `:---:`, `---:`) directly from a GFM separator row.
 */
function parseSeparatorAlignments(lineText: string): Array<'left' | 'center' | 'right'> {
  const trimmedEnd = trimLineEnd(lineText, 0, lineText.length);
  const rawPipes = findPipePositions(lineText, 0, trimmedEnd);
  const { positions: pipes } = normalizePipePositions(lineText, 0, trimmedEnd, rawPipes);
  const aligns: Array<'left' | 'center' | 'right'> = [];

  for (let i = 0; i < pipes.length - 1; i++) {
    const seg = lineText.slice(pipes[i] + 1, pipes[i + 1]).trim();
    const startsColon = seg.startsWith(':');
    const endsColon = seg.endsWith(':');
    if (startsColon && endsColon) {
      aligns.push('center');
    } else if (endsColon) {
      aligns.push('right');
    } else {
      aligns.push('left');
    }
  }

  return aligns;
}

/**
 * Builds Rendered Edit mode decorations for GFM tables without modifying Standard mode.
 * Real cell text stays editable in the buffer; pipes, separator rows, and raw padding spaces
 * are hidden with font-size:0 while exact per-column widths and alignments are computed from
 * each cell's actual on-screen visible width.
 */
export function appendRenderedEditTableDecorations(
  editor: TextEditor,
  filteredDecorations: Map<DecorationType, Array<Range | DecorationOptions>>,
  renderedEditHideRanges: Range[],
  renderedEditBeforeMarkers: DecorationOptions[]
): Range[] {
  const doc = editor.document;
  const text = doc.getText();
  const cjkWidthRatio = config.tables.cjkWidthRatio();
  const pipeColor = new ThemeColor('editorLineNumber.foreground');
  const ruleColor = new ThemeColor('editorWidget.border');

  // Snapshot zero-width hidden intervals already added (inline `**`, `[`, `](url)`, etc.)
  // BEFORE appending table pipes/padding. Do NOT include `transparent` (inline code backticks),
  // because transparent characters still occupy 1ch on screen.
  const zeroWidthIntervals: Interval[] = [];
  for (const r of renderedEditHideRanges) {
    const s = doc.offsetAt(r.start);
    const e = doc.offsetAt(r.end);
    if (s < e) zeroWidthIntervals.push({ start: s, end: e });
  }
  zeroWidthIntervals.sort((a, b) => (a.start !== b.start ? a.start - b.start : a.end - b.end));

  // Snapshot replaced emoji shortcodes (hidden text + wide rendered emoji glyph) so cells
  // containing `:white_check_mark:` etc. still count their rendered emoji width.
  const emojiItems =
    (filteredDecorations.get('emoji') as DecorationOptions[] | undefined) || [];
  const emojiGlyphs: Array<{ start: number; end: number; width: number }> = [];
  if (config.emojis.enabled()) {
    for (const item of emojiItems) {
      const r = item.range;
      const emojiText = item.renderOptions?.before?.contentText ?? '';
      if (emojiText.length > 0) {
        emojiGlyphs.push({
          start: doc.offsetAt(r.start),
          end: doc.offsetAt(r.end),
          width: Math.ceil(measureTextWidth(emojiText, cjkWidthRatio)),
        });
      }
    }
  }

  // Identify separator lines from tableRule / tableSeparatorPipe / tableSeparatorDash.
  const sepLines = new Set<number>();
  const ruleItems =
    (filteredDecorations.get('tableRule') as RenderedEditTableOption[] | undefined) || [];
  const sepPipeItems =
    (filteredDecorations.get('tableSeparatorPipe') as RenderedEditTableOption[] | undefined) || [];
  const sepDashItems =
    (filteredDecorations.get('tableSeparatorDash') as RenderedEditTableOption[] | undefined) || [];

  for (const item of [...ruleItems, ...sepPipeItems, ...sepDashItems]) {
    const r = item instanceof Range ? item : item.range;
    sepLines.add(r.start.line);
  }

  // Parse all cells and group them by line.
  const cellItems =
    (filteredDecorations.get('tableCell') as RenderedEditTableOption[] | undefined) || [];
  const allCellsByLine = new Map<number, ParsedCellInfo[]>();

  for (const item of cellItems) {
    const r = item instanceof Range ? item : item.range;
    const cellStart = doc.offsetAt(r.start);
    const cellEnd = doc.offsetAt(r.end);
    if (cellStart >= cellEnd) continue;

    let trimStart = cellStart;
    while (trimStart < cellEnd && (text[trimStart] === ' ' || text[trimStart] === '\t')) {
      trimStart++;
    }
    let trimEnd = cellEnd;
    while (trimEnd > trimStart && (text[trimEnd - 1] === ' ' || text[trimEnd - 1] === '\t')) {
      trimEnd--;
    }

    const visibleText = extractZeroWidthStrippedSlice(text, trimStart, trimEnd, zeroWidthIntervals);
    let emojiExtraWidth = 0;
    for (const eg of emojiGlyphs) {
      if (eg.start >= trimStart && eg.end <= trimEnd) {
        emojiExtraWidth += eg.width;
      }
    }
    const visibleWidth = Math.ceil(measureTextWidth(visibleText, cjkWidthRatio)) + emojiExtraWidth;
    const meta = item.renderedEditTableMeta?.kind === 'cell' ? item.renderedEditTableMeta : undefined;
    const line = r.start.line;

    const list = allCellsByLine.get(line) ?? [];
    list.push({
      range: r,
      line,
      cellStart,
      cellEnd,
      trimStart,
      trimEnd,
      visibleWidth,
      meta,
    });
    allCellsByLine.set(line, list);
  }

  for (const list of allCellsByLine.values()) {
    list.sort((a, b) => a.cellStart - b.cellStart);
  }

  // Group contiguous table lines (header + separator + data rows) into separate tables.
  const allTableLines = Array.from(new Set([...allCellsByLine.keys(), ...sepLines])).sort(
    (a, b) => a - b
  );
  const tableGroups: ParsedTableGroup[] = [];
  for (const line of allTableLines) {
    const prevGroup = tableGroups[tableGroups.length - 1];
    if (prevGroup && line === prevGroup.lines[prevGroup.lines.length - 1] + 1) {
      prevGroup.lines.push(line);
      const lineCells = allCellsByLine.get(line);
      if (lineCells) prevGroup.cellsByLine.set(line, lineCells);
      if (sepLines.has(line) && prevGroup.sepLine === undefined) prevGroup.sepLine = line;
    } else {
      const cellsByLine = new Map<number, ParsedCellInfo[]>();
      const lineCells = allCellsByLine.get(line);
      if (lineCells) cellsByLine.set(line, lineCells);
      tableGroups.push({
        lines: [line],
        cellsByLine,
        sepLine: sepLines.has(line) ? line : undefined,
      });
    }
  }

  // Compute exact column widths and alignments per table group.
  const colWidthsByLine = new Map<number, number[]>();
  const colAlignsByLine = new Map<number, Array<'left' | 'center' | 'right'>>();
  const headerLines = new Set<number>();

  for (const group of tableGroups) {
    let maxCols = 0;
    for (const cells of group.cellsByLine.values()) {
      if (cells.length > maxCols) maxCols = cells.length;
    }
    const colWidths = new Array<number>(maxCols).fill(3);
    for (const cells of group.cellsByLine.values()) {
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].visibleWidth > colWidths[i]) {
          colWidths[i] = cells[i].visibleWidth;
        }
      }
    }

    const colAligns =
      group.sepLine !== undefined
        ? parseSeparatorAlignments(doc.lineAt(group.sepLine).text)
        : [];

    if (group.lines.length > 0 && group.cellsByLine.has(group.lines[0])) {
      headerLines.add(group.lines[0]);
    }

    for (const line of group.lines) {
      colWidthsByLine.set(line, colWidths);
      colAlignsByLine.set(line, colAligns);
    }
  }

  const headerRanges: Range[] = [];

  // 1. Data/header pipes (`tablePipe`) and grid-style separator pipes (`tableSeparatorPipe`)
  const dataPipeItems =
    (filteredDecorations.get('tablePipe') as RenderedEditTableOption[] | undefined) || [];
  for (const item of [...dataPipeItems, ...sepPipeItems]) {
    const r = item instanceof Range ? item : item.range;
    renderedEditHideRanges.push(r);
    const replacement =
      item.renderedEditTableMeta && 'replacement' in item.renderedEditTableMeta
        ? item.renderedEditTableMeta.replacement ?? ''
        : item.renderOptions?.before?.contentText ?? '';
    if (replacement.length > 0) {
      renderedEditBeforeMarkers.push({
        range: new Range(r.start, r.start),
        renderOptions: { before: { contentText: replacement, color: pipeColor } },
      });
    }
  }

  const sepDashByLine = new Map<number, RenderedEditTableOption[]>();
  for (const item of sepDashItems) {
    const r = item instanceof Range ? item : item.range;
    const list = sepDashByLine.get(r.start.line) ?? [];
    list.push(item);
    sepDashByLine.set(r.start.line, list);
  }
  for (const [line, items] of sepDashByLine.entries()) {
    items.sort((a, b) => a.range.start.character - b.range.start.character);
    const colWidths = colWidthsByLine.get(line);
    for (let i = 0; i < items.length; i++) {
      const r = items[i].range;
      renderedEditHideRanges.push(r);
      const colWidth = colWidths && i < colWidths.length ? colWidths[i] : 3;
      renderedEditBeforeMarkers.push({
        range: new Range(r.start, r.start),
        renderOptions: {
          before: {
            contentText: '-'.repeat(colWidth + CELL_PADDING_CH * 2),
            color: pipeColor,
          },
        },
      });
    }
  }

  // 3. Preview-style separator horizontal rule (`tableRule`)
  for (const item of ruleItems) {
    const r = item instanceof Range ? item : item.range;
    renderedEditHideRanges.push(r);
    const colWidths = colWidthsByLine.get(r.start.line);
    const totalWidth = colWidths
      ? colWidths.reduce((sum, w) => sum + w + CELL_PADDING_CH * 2, 0)
      : item.renderedEditTableMeta?.kind === 'rule'
        ? item.renderedEditTableMeta.boxWidth
        : undefined;
    const width = totalWidth !== undefined ? `${totalWidth}ch` : '100%';
    renderedEditBeforeMarkers.push({
      range: new Range(r.start, r.start),
      renderOptions: {
        before: {
          contentText: '',
          borderColor: ruleColor,
          textDecoration:
            [
              'none',
              'display: inline-block',
              'box-sizing: border-box',
              `width: ${width}`,
              'height: 0.6em',
              'vertical-align: middle',
              'border-bottom-width: 1px',
              'border-bottom-style: solid',
            ].join('; ') + ';',
        },
      },
    });
  }

  // 4. Cells: keep real text editable, hide raw padding spaces, apply exact alignment spacers.
  for (const [line, cells] of allCellsByLine.entries()) {
    const colWidths = colWidthsByLine.get(line) ?? [];
    const colAligns = colAlignsByLine.get(line) ?? [];
    const isHeaderRow = headerLines.has(line);

    for (let colIdx = 0; colIdx < cells.length; colIdx++) {
      const cell = cells[colIdx];
      const colWidth = colIdx < colWidths.length ? colWidths[colIdx] : Math.max(3, cell.visibleWidth);
      const align = cell.meta?.cellAlign ?? colAligns[colIdx] ?? 'left';
      const { leftCh, rightCh } = computeCellPadding(colWidth, cell.visibleWidth, align);

      if (cell.trimStart === cell.trimEnd) {
        renderedEditHideRanges.push(cell.range);
        const anchor = doc.positionAt(cell.cellStart);
        renderedEditBeforeMarkers.push({
          range: new Range(anchor, anchor),
          renderOptions: {
            before: { contentText: ' '.repeat(leftCh) },
            after: { contentText: ' '.repeat(rightCh) },
          },
        });
        continue;
      }

      if (cell.trimStart > cell.cellStart) {
        renderedEditHideRanges.push(
          new Range(doc.positionAt(cell.cellStart), doc.positionAt(cell.trimStart))
        );
      }
      if (cell.trimEnd < cell.cellEnd) {
        renderedEditHideRanges.push(
          new Range(doc.positionAt(cell.trimEnd), doc.positionAt(cell.cellEnd))
        );
      }

      const trimStartPos = doc.positionAt(cell.trimStart);
      const trimEndPos = doc.positionAt(cell.trimEnd);

      renderedEditBeforeMarkers.push({
        range: new Range(trimStartPos, trimEndPos),
        renderOptions: {
          before: { contentText: ' '.repeat(leftCh) },
          after: { contentText: ' '.repeat(rightCh) },
        },
      });

      if (isHeaderRow || cell.meta?.isHeaderCell) {
        headerRanges.push(new Range(trimStartPos, trimEndPos));
      }
    }
  }

  return headerRanges;
}

export function buildRenderedEditTableOption(
  range: Range,
  decoration: DecorationRange
): RenderedEditTableOption {
  if (decoration.type === 'tableCell') {
    return {
      range,
      renderedEditTableMeta: {
        kind: 'cell',
        boxWidth: decoration.boxWidth,
        cellAlign: decoration.cellAlign,
        isHeaderCell: decoration.isHeaderCell,
        replacement: decoration.replacement,
      },
    };
  }
  if (decoration.type === 'tableRule') {
    return {
      range,
      renderedEditTableMeta: {
        kind: 'rule',
        boxWidth: decoration.boxWidth,
      },
    };
  }
  const kind =
    decoration.type === 'tableSeparatorPipe'
      ? 'separatorPipe'
      : decoration.type === 'tableSeparatorDash'
        ? 'separatorDash'
        : 'pipe';
  return {
    range,
    renderedEditTableMeta: {
      kind,
      replacement: decoration.replacement ?? '',
    },
  };
}
