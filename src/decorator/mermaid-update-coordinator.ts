import { createHash } from 'crypto';
import { ColorThemeKind, Position, Range, TextEditor, window, workspace } from 'vscode';
import type { MermaidBlock } from '../parser';
import { mapNormalizedToOriginal } from '../position-mapping';
import { renderMermaidSvg, svgToDataUri, createErrorSvg } from '../mermaid/mermaid-renderer';
import { MermaidDiagramDecorations } from './mermaid-diagram-decorations';
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
  ): Promise<void> {
    if (mermaidBlocks.length === 0) {
      this.mermaidDecorations.clear(editor);
      editor.setDecorations(hoverIndicatorDecorationType as never, []);
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
    const indicatorRanges: Range[] = [];
    const originalText = editor.document.getText();
    const dataUriPromisesByKey = new Map<string, Promise<string>>();

    const results = await mapWithConcurrency(
      mermaidBlocks,
      this.maxConcurrency,
      async (block): Promise<{ key: string; range: Range; dataUri: string; indicatorRange: Range } | null> => {
        if (token !== this.mermaidUpdateToken || editor.document.version !== documentVersion) {
          return null;
        }

        if (isSelectionOrCursorInsideOffsets(block.startPos, block.endPos, normalizedText, editor.selections, editor.document)) {
          return null;
        }

        const range = createRange(editor, block.startPos, block.endPos, normalizedText);
        if (!range) {
          return null;
        }

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

        const key = getMermaidBlockCacheKey(block, theme, fontFamily);
        let dataUriPromise = dataUriPromisesByKey.get(key);
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
          dataUriPromisesByKey.set(key, dataUriPromise);
        }

        const dataUri = await dataUriPromise;
        if (token !== this.mermaidUpdateToken || editor.document.version !== documentVersion) {
          return null;
        }

        return { key, range, dataUri, indicatorRange };
      }
    );

    for (const result of results) {
      if (!result) {
        continue;
      }
      dataUrisByKey.set(result.key, result.dataUri);
      const ranges = rangesByKey.get(result.key) || [];
      ranges.push(result.range);
      rangesByKey.set(result.key, ranges);
      indicatorRanges.push(result.indicatorRange);
    }

    if (token !== this.mermaidUpdateToken || editor.document.version !== documentVersion) {
      return;
    }

    this.mermaidDecorations.apply(editor, rangesByKey, dataUrisByKey);
    editor.setDecorations(hoverIndicatorDecorationType as never, indicatorRanges);
  }
}
