import { Range, ThemeColor, type DecorationOptions, type TextEditor } from 'vscode';
import { config } from '../config';
import type { DecorationTypeRegistry } from '../decorator/decoration-type-registry';
import type { DecorationRange, DecorationType } from '../parser';
import { appendRenderedEditTableDecorations, buildRenderedEditTableOption } from './table-renderer';

type RangeFactory = (startPos: number, endPos: number, originalText: string) => Range | null;
type FilteredDecoration = Range | DecorationOptions;

const TABLE_TYPES = new Set<DecorationType>([
  'tablePipe',
  'tableSeparatorPipe',
  'tableSeparatorDash',
  'tableRule',
  'tableCell',
]);

const PASS_THROUGH_MARKER_REPLACE_TYPES = new Set<DecorationType>([
  'blockquote',
  'listItem',
  'orderedListItem',
]);

/**
 * Filters decorations for Rendered Edit (`MD: Visual`) mode without touching
 * Standard (`MD: Hybrid`) filtering logic in `visibility-model.ts`.
 */
export function filterRenderedEditDecorations(
  editor: TextEditor,
  decorations: DecorationRange[],
  originalText: string,
  rangeFactory: RangeFactory
): Map<DecorationType, FilteredDecoration[]> {
  const selectedRanges = editor.selections.filter((s) => !s.isEmpty);
  const filtered = new Map<DecorationType, FilteredDecoration[]>();
  const selectionOverlayRanges: Range[] = [];

  const push = (type: DecorationType, item: FilteredDecoration): void => {
    const list = filtered.get(type) ?? [];
    list.push(item);
    filtered.set(type, list);
  };

  for (const decoration of decorations) {
    const range = rangeFactory(decoration.startPos, decoration.endPos, originalText);
    if (!range) continue;

    if ((decoration.type === 'codeBlock' || decoration.type === 'frontmatter') && selectedRanges.length > 0) {
      for (const selection of selectedRanges) {
        const intersection = range.intersection(selection);
        if (intersection !== undefined) {
          selectionOverlayRanges.push(intersection);
        }
      }
    }

    if (decoration.type === 'emoji') {
      if (decoration.emoji) {
        push('emoji', { range, renderOptions: { before: { contentText: decoration.emoji } } });
      }
      continue;
    }

    if (TABLE_TYPES.has(decoration.type)) {
      push(decoration.type, buildRenderedEditTableOption(range, decoration));
      continue;
    }

    if (PASS_THROUGH_MARKER_REPLACE_TYPES.has(decoration.type) && decoration.replacement) {
      const beforeOpts: Record<string, unknown> = { contentText: decoration.replacement };
      if (decoration.orderedListMarkerMismatch) {
        beforeOpts.color = new ThemeColor('editorWarning.foreground');
      }
      push(decoration.type, { range, renderOptions: { before: beforeOpts } });
      continue;
    }

    push(decoration.type, range);
  }

  if (selectionOverlayRanges.length > 0) {
    filtered.set('selectionOverlay', selectionOverlayRanges);
  }

  return filtered;
}

/**
 * Applies filtered decorations in Rendered Edit (`MD: Visual`) mode using font-size:0
 * hiding and zero-width ::before anchors so native selection and caret rendering stay intact.
 */
export function applyRenderedEditFilteredDecorations(
  editor: TextEditor,
  filteredDecorations: Map<DecorationType, FilteredDecoration[]>,
  decorationTypes: DecorationTypeRegistry,
  onApply?: (nonEmptyTypeCount: number) => void
): void {
  const renderedEditHideRanges: Range[] = [];
  const renderedEditBeforeMarkers: DecorationOptions[] = [];
  const listMarkerColor = config.colors.listMarker() ?? new ThemeColor('editor.foreground');
  const blockquoteColor = config.colors.blockquote() ?? new ThemeColor('textLink.foreground');
  const extractRange = (item: FilteredDecoration): Range => (item instanceof Range ? item : item.range);

  for (const [type, decorationType] of decorationTypes.getMap().entries()) {
    if (type === 'hide' || type === 'checkboxMarker') {
      for (const item of filteredDecorations.get(type) || []) {
        renderedEditHideRanges.push(extractRange(item));
      }
      editor.setDecorations(decorationType, []);
      continue;
    }

    if (type === 'listItem' || type === 'blockquote') {
      const contentText = type === 'listItem' ? '• ' : '│';
      const color = type === 'listItem' ? listMarkerColor : blockquoteColor;
      for (const item of filteredDecorations.get(type) || []) {
        const r = extractRange(item);
        renderedEditHideRanges.push(r);
        renderedEditBeforeMarkers.push({
          range: new Range(r.start, r.start),
          renderOptions: { before: { contentText, fontWeight: 'bold', color } },
        });
      }
      editor.setDecorations(decorationType, []);
      continue;
    }

    if (type === 'orderedListItem' || type === 'emoji') {
      if (type !== 'emoji' || config.emojis.enabled()) {
        for (const item of (filteredDecorations.get(type) as DecorationOptions[] | undefined) || []) {
          const r = extractRange(item);
          renderedEditHideRanges.push(r);
          const before = item.renderOptions?.before;
          if (before) {
            renderedEditBeforeMarkers.push({
              range: new Range(r.start, r.start),
              renderOptions: {
                before: type === 'orderedListItem' ? { ...before, color: before.color ?? listMarkerColor } : before,
              },
            });
          }
        }
      }
      editor.setDecorations(decorationType, []);
      continue;
    }

    if (TABLE_TYPES.has(type)) {
      editor.setDecorations(decorationType, []);
      continue;
    }

    editor.setDecorations(decorationType, (filteredDecorations.get(type) as Range[] | undefined) || []);
  }

  const headerRanges = appendRenderedEditTableDecorations(
    editor,
    filteredDecorations,
    renderedEditHideRanges,
    renderedEditBeforeMarkers
  );

  editor.setDecorations(decorationTypes.getRenderedEditHideDecorationType(), renderedEditHideRanges);
  editor.setDecorations(decorationTypes.getRenderedEditBeforeMarkerDecorationType(), renderedEditBeforeMarkers);
  editor.setDecorations(decorationTypes.getRenderedEditTableHeaderDecorationType(), headerRanges);
  editor.setDecorations(decorationTypes.getGhostFaintDecorationType(), []);

  if (onApply) {
    const nonEmptyTypeCount = [...filteredDecorations.values()].filter((ranges) => ranges.length > 0).length;
    onApply(nonEmptyTypeCount);
  }
}

export function clearRenderedEditDecorations(
  editor: TextEditor,
  decorationTypes: DecorationTypeRegistry
): void {
  editor.setDecorations(decorationTypes.getRenderedEditHideDecorationType(), []);
  editor.setDecorations(decorationTypes.getRenderedEditBeforeMarkerDecorationType(), []);
  editor.setDecorations(decorationTypes.getRenderedEditTableHeaderDecorationType(), []);
}
