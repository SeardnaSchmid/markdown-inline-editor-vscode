import { createHash } from 'crypto';
import { ColorThemeKind, Position, Range, TextEditor, window, workspace } from 'vscode';
import type { MermaidBlock } from '../parser';
import { mapNormalizedToOriginal } from '../position-mapping';
import { renderMermaidSvg, svgToDataUri, createErrorSvg } from '../mermaid/mermaid-renderer';
import { MermaidDiagramDecorations } from './mermaid-diagram-decorations';
import { computeMermaidAnchor } from './mermaid-anchor';
import { createRange, isSelectionOrCursorInsideOffsets } from './editor-decoration-applier';
import { logWarn } from '../logging';

type MermaidBlockKeyCacheEntry = {
  theme: 'default' | 'dark';
  fontFamily?: string;
  numLines: number;
  key: string;
};

const mermaidBlockKeyCache = new WeakMap<MermaidBlock, MermaidBlockKeyCacheEntry>();

function getMermaidBlockCacheKey(
  block: MermaidBlock,
  theme: 'default' | 'dark',
  fontFamily?: string
): string {
  const cached = mermaidBlockKeyCache.get(block);
  if (
    cached &&
    cached.theme === theme &&
    cached.fontFamily === fontFamily &&
    cached.numLines === block.numLines
  ) {
    return cached.key;
  }

  const keySource = `${block.source}\n${theme}\n${fontFamily ?? ''}\n${block.numLines}`;
  const key = createHash('sha256').update(keySource).digest('hex');
  mermaidBlockKeyCache.set(block, { theme, fontFamily, numLines: block.numLines, key });
  return key;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  maxConcurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index], index);
    }
  };

  const concurrency = Math.max(1, Math.min(maxConcurrency, items.length));
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

export class MermaidUpdateCoordinator {
  private mermaidUpdateToken = 0;

  constructor(
    private readonly mermaidDecorations: MermaidDiagramDecorations,
    private readonly maxConcurrency: number
  ) {}

  async update(
    editor: TextEditor,
    mermaidBlocks: MermaidBlock[],
    normalizedText: string,
    documentVersion: number,
    hoverIndicatorDecorationType: { dispose(): void } & { key?: string },
    sourceDecorationType: { dispose(): void } & { key?: string },
  ): Promise<void> {
    if (mermaidBlocks.length === 0) {
      this.mermaidDecorations.clear(editor);
      editor.setDecorations(hoverIndicatorDecorationType as never, []);
      editor.setDecorations(sourceDecorationType as never, []);
      return;
    }

    const token = ++this.mermaidUpdateToken;
    const theme = window.activeColorTheme.kind === ColorThemeKind.Dark ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrast
      ? 'dark'
      : 'default';
    const fontFamily = workspace.getConfiguration('editor').get<string>('fontFamily');

    const rangesByKey = new Map<string, Range[]>();
    const dataUrisByKey = new Map<string, string>();
    const lineOffsetsByKey = new Map<string, number>();
    const indicatorRanges: Range[] = [];
    const sourceRanges: Range[] = [];
    const originalText = editor.document.getText();
    const dataUriPromisesByKey = new Map<string, Promise<string>>();

    const results = await mapWithConcurrency(
      mermaidBlocks,
      this.maxConcurrency,
      async (block): Promise<{
        key: string;
        range: Range;
        dataUri: string;
        indicatorRange: Range;
        sourceRange: Range;
        lineOffset: number;
      } | null> => {
        if (token !== this.mermaidUpdateToken || editor.document.version !== documentVersion) {
          return null;
        }

        if (isSelectionOrCursorInsideOffsets(block.startPos, block.endPos, normalizedText, editor.selections, editor.document)) {
          return null;
        }

        const sourceRange = createRange(editor, block.startPos, block.endPos, normalizedText);
        if (!sourceRange) {
          return null;
        }

        // The image hangs off a single line, and VS Code only builds DOM for
        // visible lines — anchoring at the block start makes the diagram vanish
        // once the opening fence scrolls above the viewport.
        const anchor = computeMermaidAnchor(
          sourceRange.start.line,
          sourceRange.end.line,
          editor.visibleRanges ?? []
        );
        const anchorPosition = new Position(anchor.anchorLine, 0);
        const range = new Range(anchorPosition, anchorPosition);

        const blockStart = mapNormalizedToOriginal(block.startPos, normalizedText);
        const openingFenceLineEnd = originalText.indexOf('\n', blockStart);
        const contentStart = openingFenceLineEnd !== -1 ? openingFenceLineEnd + 1 : blockStart;
        const contentStartPos = editor.document.positionAt(contentStart);
        const line = editor.document.lineAt(contentStartPos.line);
        const indicatorEndChar = Math.min(contentStartPos.character + 1, line.text.length);
        const indicatorRange = new Range(
          contentStartPos,
          new Position(contentStartPos.line, indicatorEndChar)
        );

        // The rendered SVG does not depend on the anchor, so it is deduplicated
        // by svgKey; the decoration type does, because the offset rides on its
        // margin, so its key carries the offset too.
        const svgKey = getMermaidBlockCacheKey(block, theme, fontFamily);
        const key = `${svgKey}:${anchor.lineOffset}`;
        let dataUriPromise = dataUriPromisesByKey.get(svgKey);
        if (!dataUriPromise) {
          dataUriPromise = (async () => {
            try {
              const svg = await renderMermaidSvg(block.source, { theme, fontFamily, numLines: block.numLines });
              return svgToDataUri(svg);
            } catch (error) {
              logWarn('Mermaid render failed', error);
              const message = error instanceof Error
                ? (error.message || error.toString() || 'Rendering failed')
                : (typeof error === 'string' ? error : String(error) || 'Rendering failed');
              const errorSvg = createErrorSvg(
                message.trim().length > 0 ? message : 'Unknown rendering error occurred',
                Math.max(400, block.numLines * 20),
                block.numLines * 20,
                theme === 'dark'
              );
              return svgToDataUri(errorSvg);
            }
          })();
          dataUriPromisesByKey.set(svgKey, dataUriPromise);
        }

        const dataUri = await dataUriPromise;
        if (token !== this.mermaidUpdateToken || editor.document.version !== documentVersion) {
          return null;
        }

        return { key, range, dataUri, indicatorRange, sourceRange, lineOffset: anchor.lineOffset };
      }
    );

    for (const result of results) {
      if (!result) {
        continue;
      }
      dataUrisByKey.set(result.key, result.dataUri);
      lineOffsetsByKey.set(result.key, result.lineOffset);
      const ranges = rangesByKey.get(result.key) || [];
      ranges.push(result.range);
      rangesByKey.set(result.key, ranges);
      indicatorRanges.push(result.indicatorRange);
      sourceRanges.push(result.sourceRange);
    }

    if (token !== this.mermaidUpdateToken || editor.document.version !== documentVersion) {
      return;
    }

    this.mermaidDecorations.apply(editor, rangesByKey, dataUrisByKey, lineOffsetsByKey);
    editor.setDecorations(hoverIndicatorDecorationType as never, indicatorRanges);
    editor.setDecorations(sourceDecorationType as never, sourceRanges);
  }
}
