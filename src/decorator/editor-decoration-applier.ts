import { DecorationOptions, Range, TextDocument, TextEditor } from 'vscode';
import type { DecorationType, ScopeRange } from '../parser';
import { mapNormalizedToOriginal } from '../position-mapping';
import { config } from '../config';
import type { DecorationTypeRegistry } from './decoration-type-registry';
import type { ScopeEntry } from './visibility-model';

export function createRange(
  editor: TextEditor,
  startPos: number,
  endPos: number,
  originalText?: string
): Range | null {
  try {
    const mappedStart = mapNormalizedToOriginal(startPos, originalText);
    const mappedEnd = mapNormalizedToOriginal(endPos, originalText);
    return new Range(
      editor.document.positionAt(mappedStart),
      editor.document.positionAt(mappedEnd)
    );
  } catch {
    return null;
  }
}

export function buildScopeEntries(
  editor: TextEditor | undefined,
  scopes: ScopeRange[],
  originalText: string
): ScopeEntry[] {
  if (!editor || scopes.length === 0) {
    return [];
  }

  const entries: ScopeEntry[] = [];
  for (const scope of scopes) {
    const range = createRange(editor, scope.startPos, scope.endPos, originalText);
    if (range) {
      entries.push({
        startPos: scope.startPos,
        endPos: scope.endPos,
        range,
        kind: scope.kind,
      });
    }
  }
  return entries;
}

export function isSelectionOrCursorInsideOffsets(
  startPos: number,
  endPos: number,
  normalizedText: string,
  selections: readonly Range[],
  document: TextDocument
): boolean {
  const mappedStart = mapNormalizedToOriginal(startPos, normalizedText);
  const mappedEnd = mapNormalizedToOriginal(endPos, normalizedText);

  return selections.some((selection) => {
    const selectionStart = document.offsetAt(selection.start);
    const selectionEnd = document.offsetAt(selection.end);
    if (selectionStart === selectionEnd) {
      return selectionStart >= mappedStart && selectionStart <= mappedEnd;
    }
    return selectionStart <= mappedEnd && selectionEnd >= mappedStart;
  });
}

const lastAppliedDecorations = new Map<string, Map<string, string>>();

function serializeRanges(ranges: Range[]): string {
  return ranges
    .map((range) =>
      `${range.start.line},${range.start.character},${range.end.line},${range.end.character}`
    )
    .join('|');
}

function serializeDecorationOptions(options: DecorationOptions[]): string {
  return options
    .map((option) => {
      const range = option.range;
      const after = option.renderOptions?.after?.contentText ?? '';
      const before = option.renderOptions?.before?.contentText ?? '';
      return `${range.start.line},${range.start.character},${range.end.line},${range.end.character}:${before}:${after}`;
    })
    .join('|');
}

function getAppliedCacheKey(editor: TextEditor): string {
  return editor.document.uri.toString();
}

function getOrCreateAppliedCache(editor: TextEditor): Map<string, string> {
  const key = getAppliedCacheKey(editor);
  let cache = lastAppliedDecorations.get(key);
  if (!cache) {
    cache = new Map();
    lastAppliedDecorations.set(key, cache);
  }
  return cache;
}

function shouldApplyDecoration(
  appliedCache: Map<string, string>,
  cacheKey: string,
  serialized: string,
  force: boolean
): boolean {
  if (force) {
    appliedCache.set(cacheKey, serialized);
    return true;
  }
  const previous = appliedCache.get(cacheKey);
  if (previous === serialized) {
    return false;
  }
  appliedCache.set(cacheKey, serialized);
  return true;
}

/** Clears cached applied decoration snapshots so the next apply always runs setDecorations. */
export function clearAppliedDecorationCache(documentUri?: string): void {
  if (documentUri) {
    lastAppliedDecorations.delete(documentUri);
    return;
  }
  lastAppliedDecorations.clear();
}

export function applyFilteredDecorations(
  editor: TextEditor,
  filteredDecorations: Map<DecorationType, Array<Range | DecorationOptions>>,
  decorationTypes: DecorationTypeRegistry,
  onApply?: (nonEmptyTypeCount: number) => void,
  force = false
): void {
  const renderOptionsTypes = new Set<DecorationType>([
    'emoji', 'orderedListItem', 'tablePipe', 'tableSeparatorPipe', 'tableSeparatorDash', 'tableCell',
  ]);
  const appliedCache = getOrCreateAppliedCache(editor);

  for (const [type, decorationType] of decorationTypes.getMap().entries()) {
    if (type === 'emoji') {
      if (!config.emojis.enabled()) {
        const serialized = '';
        if (shouldApplyDecoration(appliedCache, type, serialized, force)) {
          editor.setDecorations(decorationType, []);
        }
        continue;
      }
      const emojiRanges = filteredDecorations.get(type) as DecorationOptions[] | undefined;
      const nextRanges = emojiRanges || [];
      const serialized = serializeDecorationOptions(nextRanges);
      if (shouldApplyDecoration(appliedCache, type, serialized, force)) {
        editor.setDecorations(decorationType, nextRanges);
      }
      continue;
    }

    if (renderOptionsTypes.has(type)) {
      const optionsRanges = filteredDecorations.get(type) as DecorationOptions[] | undefined;
      const nextRanges = optionsRanges || [];
      const serialized = serializeDecorationOptions(nextRanges);
      if (shouldApplyDecoration(appliedCache, type, serialized, force)) {
        editor.setDecorations(decorationType, nextRanges);
      }
      continue;
    }

    const ranges = filteredDecorations.get(type) as Range[] | undefined;
    const nextRanges = ranges || [];
    const serialized = serializeRanges(nextRanges);
    if (shouldApplyDecoration(appliedCache, type, serialized, force)) {
      editor.setDecorations(decorationType, nextRanges);
    }
  }

  const ghostFaintRanges = (filteredDecorations.get('ghostFaint') as Range[] | undefined) || [];
  const ghostSerialized = serializeRanges(ghostFaintRanges);
  if (shouldApplyDecoration(appliedCache, 'ghostFaint', ghostSerialized, force)) {
    editor.setDecorations(decorationTypes.getGhostFaintDecorationType(), ghostFaintRanges);
  }

  if (onApply) {
    const nonEmptyTypeCount = [...filteredDecorations.values()].filter((ranges) => ranges.length > 0).length;
    onApply(nonEmptyTypeCount);
  }
}
