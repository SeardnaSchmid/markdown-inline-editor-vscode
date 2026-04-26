import { Range, Position, TextEditor, TextDocument, TextDocumentChangeEvent, window, TextEditorSelectionChangeKind, ColorThemeKind, workspace, DecorationOptions, Memento } from 'vscode';
import { createHash } from 'crypto';
import { DecorationRange, DecorationType, MermaidBlock, MathRegion, ScopeRange } from './parser';
import { mapNormalizedToOriginal } from './position-mapping';
import { config } from './config';
import { isDiffLikeUri, isDiffViewVisible } from './diff-context';
import { MarkdownParseCache } from './markdown-parse-cache';
import { DecorationTypeRegistry } from './decorator/decoration-type-registry';
import { filterDecorationsForEditor, ScopeEntry } from './decorator/visibility-model';
import { handleCheckboxClick } from './decorator/checkbox-toggle';
import { MermaidDiagramDecorations } from './decorator/mermaid-diagram-decorations';
import { MathDecorations } from './math/math-decorations';
import { renderMermaidSvg, svgToDataUri, createErrorSvg } from './mermaid/mermaid-renderer';
import { MermaidHoverIndicatorDecorationType } from './decorations';

/** Workspace state key prefix for per-file decoration toggle persistence. */
const DECORATION_STATE_KEY_PREFIX = 'mdInline.decorationsEnabled';

/**
 * Performance and caching constants.
 */
const PERFORMANCE_CONSTANTS = {
  /** Debounce timeout for document changes (ms) - balances responsiveness vs performance */
  DEBOUNCE_TIMEOUT_MS: 150,
  /** Maximum timeout for requestIdleCallback (ms) - ensures updates don't wait indefinitely */
  IDLE_CALLBACK_TIMEOUT_MS: 300,
  /** Max Mermaid renders in flight (bounded parallelism) */
  MERMAID_MAX_CONCURRENCY: 4,
} as const;

type MermaidBlockKeyCacheEntry = {
  theme: 'default' | 'dark';
  fontFamily?: string;
  numLines: number;
  key: string;
};

// Cache hash computation results per block object (cleared automatically on GC / parse cache eviction).
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


/**
 * Manages the application of text decorations to markdown documents in VS Code.
 * 
 * This class orchestrates the parsing of markdown content and applies visual
 * decorations (bold, italic, headings, etc.) directly in the editor. It also
 * handles showing raw markdown syntax when text is selected.
 * 
 * @class Decorator
 * @example
 * const decorator = new Decorator(parseCache);
 * decorator.setActiveEditor(vscode.window.activeTextEditor);
 * // Decorations are automatically updated when the editor content changes
 */
export class Decorator {
  /** The currently active text editor being decorated */
  activeEditor: TextEditor | undefined;

  /**
   * Optional test hook — set from E2E tests via the exported ExtensionApi.
   * Called at the end of every applyDecorations() cycle with the number of
   * decoration types that had at least one non-empty range applied.
   * Undefined in production; never called when decorations are disabled.
   */
  onApply: ((nonEmptyTypeCount: number) => void) | undefined = undefined;

  private parseCache: MarkdownParseCache;
  private updateTimeout: NodeJS.Timeout | undefined;

  /** Pending update batching: track last document version that triggered an update */
  private pendingUpdateVersion = new Map<string, number>();

  /** requestIdleCallback handle for idle updates */
  private idleCallbackHandle: number | undefined;

  /** Per-file decoration enabled state, keyed by URI string */
  private fileDecorationState = new Map<string, boolean>();

  /** Workspace state for persisting per-file toggle state across sessions */
  private workspaceState?: Memento;

  /** Whether to skip decorations in diff views (inverse of applyDecorations setting) */
  private skipDecorationsInDiffView = true;

  private decorationTypes: DecorationTypeRegistry;
  private mermaidDecorations = new MermaidDiagramDecorations();
  private mathDecorations = new MathDecorations();
  private mermaidUpdateToken = 0;
  private mermaidHoverIndicatorDecorationType = MermaidHoverIndicatorDecorationType();

  constructor(parseCache: MarkdownParseCache, workspaceState?: Memento) {
    this.parseCache = parseCache;
    this.workspaceState = workspaceState;
    this.decorationTypes = new DecorationTypeRegistry({
      getGhostFaintOpacity: () => this.getGhostFaintOpacity(),
      getFrontmatterDelimiterOpacity: () => this.getFrontmatterDelimiterOpacity(),
      getCodeBlockLanguageOpacity: () => this.getCodeBlockLanguageOpacity(),
      getHeading1Color: () => config.colors.heading1(),
      getHeading2Color: () => config.colors.heading2(),
      getHeading3Color: () => config.colors.heading3(),
      getHeading4Color: () => config.colors.heading4(),
      getHeading5Color: () => config.colors.heading5(),
      getHeading6Color: () => config.colors.heading6(),
      getLinkColor: () => config.colors.link(),
      getListMarkerColor: () => config.colors.listMarker(),
      getInlineCodeColor: () => config.colors.inlineCode(),
      getInlineCodeBackgroundColor: () => config.colors.inlineCodeBackground(),
      getEmphasisColor: () => config.colors.emphasis(),
      getBlockquoteColor: () => config.colors.blockquote(),
      getImageColor: () => config.colors.image(),
      getHorizontalRuleColor: () => config.colors.horizontalRule(),
      getCheckboxColor: () => config.colors.checkbox(),
    });
  }

  /**
   * Sets the active text editor and immediately updates decorations.
   * 
   * This should be called when switching between editors or when a new
   * markdown file is opened. The decorations will be applied to the new editor.
   * 
   * @param {TextEditor | undefined} textEditor - The text editor to decorate, or undefined to clear
   * 
   * @example
   * decorator.setActiveEditor(vscode.window.activeTextEditor);
   */
  setActiveEditor(textEditor: TextEditor | undefined) {
    // Clear any pending debounced updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }

    if (!textEditor) {
      return;
    }

    this.activeEditor = textEditor;

    // Update immediately when switching editors (no debounce)
    this.updateDecorationsForSelection();
  }

  /**
   * Updates decorations for selection changes (immediate, no debounce).
   *
   * This method is optimized for selection changes where the document content
   * hasn't changed. It uses cached decorations and only re-filters based on
   * the new selection.
   *
   * Also handles checkbox toggle when clicking inside [ ] or [x].
   *
   * @param kind - The kind of selection change (Mouse, Keyboard, or Command)
   * @example
   * decorator.updateDecorationsForSelection(TextEditorSelectionChangeKind.Mouse);
   */
  updateDecorationsForSelection(kind?: TextEditorSelectionChangeKind) {
    // Early exit for non-markdown files
    if (!this.activeEditor || !this.isMarkdownDocument()) {
      return;
    }

    // Check for checkbox click (single cursor, no selection)
    // If checkbox was toggled, skip decoration update to avoid flicker
    if (kind === TextEditorSelectionChangeKind.Mouse && handleCheckboxClick(this.activeEditor)) {
      return;
    }

    // Immediate update without debounce for selection changes
    this.updateDecorationsInternal();
  }

  // Checkbox behavior lives in decorator/checkbox-toggle.ts

  /**
   * Updates decorations for document changes (debounced with batching).
   * 
   * This method handles document content changes and uses smart debouncing to prevent
   * excessive parsing during rapid typing. It batches multiple changes and uses
   * requestIdleCallback when available for non-urgent updates.
   * 
   * @param {TextDocumentChangeEvent} event - The document change event (optional)
   * 
   * @example
   * decorator.updateDecorationsForDocument(event);
   */
  updateDecorationsForDocument(event?: TextDocumentChangeEvent) {
    // Early exit for non-markdown files (before any work)
    if (!this.activeEditor || !this.isMarkdownDocument()) {
      return;
    }

    const document = event?.document || this.activeEditor.document;
    const cacheKey = document.uri.toString();

    // Invalidate cache on document change
    if (event) {
      this.invalidateCache(document);
    }

    // Track this version to batch updates
    this.pendingUpdateVersion.set(cacheKey, document.version);

    // Clear any pending timeout-based updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }

    // Cancel any pending idle callback
    if (this.idleCallbackHandle !== undefined) {
      this.cancelIdleCallback(this.idleCallbackHandle);
      this.idleCallbackHandle = undefined;
    }

    // Debounce with two-tier strategy:
    // 1. Short timeout for responsive feedback
    // 2. Fallback to idle callback for heavy work during continuous typing
    this.updateTimeout = setTimeout(() => {
      this.updateTimeout = undefined;

      // Check if document version changed since we scheduled this update (batching)
      const latestVersion = this.activeEditor?.document.version;
      const scheduledVersion = this.pendingUpdateVersion.get(cacheKey);

      if (latestVersion !== undefined && scheduledVersion !== undefined && latestVersion !== scheduledVersion) {
        // Document changed again, skip this update (another one is queued)
        return;
      }

      // Use requestIdleCallback wrapper for non-urgent updates
      // This will use requestIdleCallback in browser or setTimeout in Node.js
      this.idleCallbackHandle = this.requestIdleCallback(() => {
        this.idleCallbackHandle = undefined;
        this.updateDecorationsInternal();
        this.pendingUpdateVersion.delete(cacheKey);
      }, { timeout: PERFORMANCE_CONSTANTS.IDLE_CALLBACK_TIMEOUT_MS });
    }, PERFORMANCE_CONSTANTS.DEBOUNCE_TIMEOUT_MS);
  }

  /**
   * Toggle decorations on/off.
   * 
   * @returns {boolean} The new state (true = enabled, false = disabled)
   */
  toggleDecorations(): boolean {
    const uri = this.activeEditor?.document.uri.toString();
    if (!uri) { return true; }

    const next = !this.isEnabledForUri(uri);
    this.fileDecorationState.set(uri, next);
    void this.workspaceState?.update(`${DECORATION_STATE_KEY_PREFIX}.${uri}`, next);

    if (next) {
      // Re-enable: update decorations immediately
      this.updateDecorationsForSelection();
    } else {
      // Disable: clear all decorations
      this.clearAllDecorations();
    }

    return next;
  }

  /**
   * Check if decorations are currently enabled for the active file.
   *
   * @returns {boolean} True if decorations are enabled
   */
  isEnabled(): boolean {
    const uri = this.activeEditor?.document.uri.toString();
    if (!uri) { return true; }
    return this.isEnabledForUri(uri);
  }

  /**
   * Get the enabled state for a specific file URI, loading from persisted
   * state on first access.
   *
   * @param {string} uri - The file URI string
   * @returns {boolean} True if decorations are enabled for that file
   */
  private isEnabledForUri(uri: string): boolean {
    let cached = this.fileDecorationState.get(uri);
    if (cached === undefined) {
      cached = this.workspaceState?.get<boolean>(`${DECORATION_STATE_KEY_PREFIX}.${uri}`, true) ?? true;
      this.fileDecorationState.set(uri, cached);
    }
    return cached;
  }

  /**
   * Migrate toggle state when a file is renamed.
   *
   * @param {string} oldUri - The old file URI string
   * @param {string} newUri - The new file URI string
   */
  renameFile(oldUri: string, newUri: string): void {
    const oldKey = `${DECORATION_STATE_KEY_PREFIX}.${oldUri}`;
    const newKey = `${DECORATION_STATE_KEY_PREFIX}.${newUri}`;

    // Migrate in-memory state
    const cachedValue = this.fileDecorationState.get(oldUri);
    if (cachedValue !== undefined) {
      this.fileDecorationState.set(newUri, cachedValue);
      this.fileDecorationState.delete(oldUri);
    }

    // Migrate persisted state, using cached value when available to avoid a redundant read
    const persistedValue = cachedValue ?? this.workspaceState?.get<boolean | undefined>(oldKey, undefined);
    if (persistedValue !== undefined) {
      void this.workspaceState?.update(newKey, persistedValue);
      void this.workspaceState?.update(oldKey, undefined);
    }
  }

  /**
   * Updates the diff view decoration setting.
   * 
   * @param {boolean} skipDecorations - True to skip decorations in diff views (show raw markdown)
   */
  updateDiffViewDecorationSetting(skipDecorations: boolean): void {
    this.skipDecorationsInDiffView = skipDecorations;
  }

  /**
   * Clear all decorations from the active editor.
   * 
   * @private
   */
  private clearAllDecorations(): void {
    if (!this.activeEditor) {
      return;
    }

    // Set all decoration types to empty arrays
    for (const decorationType of this.decorationTypes.getMap().values()) {
      this.activeEditor.setDecorations(decorationType, []);
    }
    
    // Also clear ghost faint decoration (not in decorationTypeMap)
    this.activeEditor.setDecorations(this.decorationTypes.getGhostFaintDecorationType(), []);
    this.mermaidDecorations.clear(this.activeEditor);
    this.mathDecorations.clear(this.activeEditor);
    this.activeEditor.setDecorations(this.mermaidHoverIndicatorDecorationType, []);
  }

  /**
   * Internal method that performs the actual decoration update.
   * This orchestrates parsing, filtering, and application.
   */
  private updateDecorationsInternal() {
    if (!this.activeEditor) {
      return;
    }

    const document = this.activeEditor.document;

    // Early exit if decorations are disabled for this file
    if (!this.isEnabledForUri(document.uri.toString())) {
      return;
    }

    // Early exit for non-markdown files
    if (!this.isMarkdownDocument()) {
      return;
    }

    // Check if we should skip decorations in diff mode
    if (this.skipDecorationsInDiffView && this.isDiffEditor()) {
      this.clearAllDecorations();
      return;
    }

    // Parse document (uses cache if version unchanged)
    const version = document.version;
    const { decorations, scopes, text, mermaidBlocks, mathRegions } = this.parseDocument(document);

    // Re-validate version before applying (race condition protection)
    if (document.version !== version) {
      return; // Document changed during parse, skip this update
    }

    // Filter decorations based on selections (pass original text for offset adjustment)
    const filtered = this.filterDecorations(decorations, scopes, text);

    // Apply decorations
    this.applyDecorations(filtered);
    if (config.math.enabled() && mathRegions.length > 0) {
      this.applyMathDecorations(mathRegions, text);
    } else {
      if (this.activeEditor) {
        this.mathDecorations.clear(this.activeEditor);
      }
    }
    void this.updateMermaidDiagrams(mermaidBlocks, text, document.version);
  }

  /**
   * Applies math decorations for inline and block regions using normalized positions.
   * When selection or cursor intersects a math region, that region is shown raw (range passed as null).
   */
  private applyMathDecorations(mathRegions: MathRegion[], normalizedText: string): void {
    if (!this.activeEditor) return;
    const editor = this.activeEditor;
    const regionsWithRanges = mathRegions.map((region) => {
      const inside = this.isSelectionOrCursorInsideOffsets(
        region.startPos,
        region.endPos,
        normalizedText,
        editor.selections,
        editor.document
      );
      return {
        region,
        range: inside ? null : this.createRange(region.startPos, region.endPos, normalizedText),
      };
    });
    this.mathDecorations.apply(editor, regionsWithRanges);
  }

  /**
   * Checks if the document is a markdown file.
   * 
   * @private
   * @returns {boolean} True if document is markdown
   */
  private isMarkdownDocument(): boolean {
    if (!this.activeEditor) {
      return false;
    }
    // 'skill'         (#58): SKILL.md files assigned languageId 'skill' by the SKILL extension.
    // 'markdoc'       (#61): Markdoc files assigned languageId 'markdoc' by the Markdoc language server.
    // 'mdc'           (#61): Nuxt Content .mdc files assigned languageId 'mdc' by vscode-mdc.
    // 'juliamarkdown' (#61): Julia Markdown files (VS Code built-in identifier).
    // 'rmarkdown'     (#61): R Markdown files assigned languageId 'rmarkdown' by vscode-R.
    return ['markdown', 'md', 'mdx', 'skill', 'markdoc', 'mdc', 'juliamarkdown', 'rmarkdown'].includes(this.activeEditor.document.languageId);
  }

  /**
   * Detects if the current editor is viewing a diff.
   * 
   * For side-by-side diff views, checks ALL visible editors to see if any
   * are in a diff context. This ensures both sides of the diff have
   * decorations disabled, regardless of which side is currently active.
   * 
   * @private
   * @returns {boolean} True if editor is in diff mode
   */
  private isDiffEditor(): boolean {
    if (!this.activeEditor) {
      return false;
    }

    // Check the active editor first
    if (isDiffLikeUri(this.activeEditor.document.uri)) {
      return true;
    }

    // For side-by-side diff views, check all visible editors
    // If ANY visible editor is in a diff context, we're in a diff view
    // This ensures both sides of the diff have decorations disabled
    return isDiffViewVisible(window.visibleTextEditors);
  }

  /**
   * Parses the document and returns decoration ranges and scopes.
   * Uses cache if document version is unchanged.
   * 
   * @private
   * @param {TextDocument} document - The document to parse
   * @returns Parsed decorations and scopes
   */
  private parseDocument(document: TextDocument): {
    decorations: DecorationRange[];
    scopes: ScopeEntry[];
    text: string;
    mermaidBlocks: MermaidBlock[];
    mathRegions: MathRegion[];
  } {
    const entry = this.parseCache.get(document);
    const scopeEntries = this.buildScopeEntries(entry.scopes, entry.text);
    return {
      decorations: entry.decorations,
      scopes: scopeEntries,
      text: entry.text,
      mermaidBlocks: entry.mermaidBlocks,
      mathRegions: entry.mathRegions,
    };
  }

  private async updateMermaidDiagrams(
    mermaidBlocks: MermaidBlock[],
    text: string,
    documentVersion: number
  ): Promise<void> {
    if (!this.activeEditor) {
      return;
    }

    const editor = this.activeEditor;
    if (mermaidBlocks.length === 0) {
      this.mermaidDecorations.clear(editor);
      editor.setDecorations(this.mermaidHoverIndicatorDecorationType, []);
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

    // Deduplicate renders for identical keys during this update (parallel-safe).
    const dataUriPromisesByKey = new Map<string, Promise<string>>();

    const results = await mapWithConcurrency(
      mermaidBlocks,
      PERFORMANCE_CONSTANTS.MERMAID_MAX_CONCURRENCY,
      async (block): Promise<{ key: string; range: Range; dataUri: string; indicatorRange: Range } | null> => {
        // Early exit checks (token/version can change while we await renders).
        if (token !== this.mermaidUpdateToken || editor.document.version !== documentVersion) {
          return null;
        }

        if (this.isSelectionOrCursorInsideOffsets(block.startPos, block.endPos, text, editor.selections, editor.document)) {
          return null;
        }

        const range = this.createRange(block.startPos, block.endPos, text);
        if (!range) {
          return null;
        }

        // Add indicator decoration at the start of the mermaid block content
        // Place it at the beginning of the first line of content (after opening fence line).
        const blockStart = mapNormalizedToOriginal(block.startPos, text);
        const openingFenceLineEnd = originalText.indexOf('\n', blockStart);
        const contentStart = openingFenceLineEnd !== -1 ? openingFenceLineEnd + 1 : blockStart;

        const contentStartPos = editor.document.positionAt(contentStart);
        // Create a small range (1 character) at the start of content for the indicator.
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
              console.warn('Mermaid render failed:', error instanceof Error ? error.message : error);
              // Create error SVG to display instead of silently failing.
              let errorMessage: string;
              if (error instanceof Error) {
                errorMessage = error.message || error.toString() || 'Rendering failed';
              } else if (typeof error === 'string') {
                errorMessage = error;
              } else {
                errorMessage = String(error) || 'Rendering failed';
              }
              if (!errorMessage || errorMessage.trim().length === 0) {
                errorMessage = 'Unknown rendering error occurred';
              }
              const errorSvg = createErrorSvg(
                errorMessage,
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

    // Merge results sequentially (single apply at end).
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
    
    // Apply hover indicator decorations
    editor.setDecorations(this.mermaidHoverIndicatorDecorationType, indicatorRanges);
  }

  private isSelectionOrCursorInsideOffsets(
    startPos: number,
    endPos: number,
    text: string,
    selections: readonly Range[],
    document: TextDocument
  ): boolean {
    const mappedStart = mapNormalizedToOriginal(startPos, text);
    const mappedEnd = mapNormalizedToOriginal(endPos, text);

    return selections.some((selection) => {
      const selectionStart = document.offsetAt(selection.start);
      const selectionEnd = document.offsetAt(selection.end);
      if (selectionStart === selectionEnd) {
        return selectionStart >= mappedStart && selectionStart <= mappedEnd;
      }
      return selectionStart <= mappedEnd && selectionEnd >= mappedStart;
    });
  }

  /**
   * Builds scope entries from parser-emitted scope ranges.
   */
  private buildScopeEntries(scopes: ScopeRange[], originalText: string): ScopeEntry[] {
    if (!this.activeEditor || scopes.length === 0) {
      return [];
    }

    const entries: ScopeEntry[] = [];
    for (const scope of scopes) {
      const range = this.createRange(scope.startPos, scope.endPos, originalText);
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

  /**
   * Filters decorations based on current selections and groups by type.
   * Implements 3-state model: Rendered (default), Ghost (cursor on line), Raw (cursor/selection in scope).
   * 
   * @private
   * @param {DecorationRange[]} decorations - Decorations to filter
   * @param {string} originalText - Original document text (for offset adjustment)
   * @returns {Map<DecorationType, Array<Range | DecorationOptions>>} Filtered decorations grouped by type
   */
  private filterDecorations(
    decorations: DecorationRange[],
    scopes: ScopeEntry[],
    originalText: string
  ): Map<DecorationType, Array<Range | DecorationOptions>> {
    if (!this.activeEditor) {
      return new Map();
    }

    return filterDecorationsForEditor(
      this.activeEditor,
      decorations,
      scopes,
      originalText,
      (startPos, endPos, text) => this.createRange(startPos, endPos, text)
    );
  }

  /**
   * Applies filtered decorations to the editor.
   * 
   * @private
   * @param {Map<DecorationType, Array<Range | DecorationOptions>>} filteredDecorations - Decorations grouped by type
   */
  private applyDecorations(filteredDecorations: Map<DecorationType, Array<Range | DecorationOptions>>) {
    if (!this.activeEditor) {
      return;
    }

    // Types that use per-range renderOptions (DecorationOptions, not plain Range)
    const renderOptionsTypes = new Set<DecorationType>([
      'emoji', 'orderedListItem', 'tablePipe', 'tableSeparatorPipe', 'tableSeparatorDash', 'tableCell',
    ]);

    // Apply all decorations by iterating through the type map
    for (const [type, decorationType] of this.decorationTypes.getMap().entries()) {
      if (type === 'emoji') {
        if (!config.emojis.enabled()) {
          this.activeEditor.setDecorations(decorationType, []);
          continue;
        }
        const emojiRanges = filteredDecorations.get(type) as DecorationOptions[] | undefined;
        this.activeEditor.setDecorations(decorationType, emojiRanges || []);
        continue;
      }

      if (renderOptionsTypes.has(type)) {
        const optionsRanges = filteredDecorations.get(type) as DecorationOptions[] | undefined;
        this.activeEditor.setDecorations(decorationType, optionsRanges || []);
        continue;
      }

      const ranges = filteredDecorations.get(type) as Range[] | undefined;
      this.activeEditor.setDecorations(decorationType, ranges || []);
    }

    const ghostFaintRanges = (filteredDecorations.get('ghostFaint') as Range[] | undefined) || [];
    this.activeEditor.setDecorations(this.decorationTypes.getGhostFaintDecorationType(), ghostFaintRanges);

    // Fire optional test hook (E2E only — undefined in production).
    if (this.onApply) {
      const nonEmptyTypeCount = [...filteredDecorations.values()].filter(r => r.length > 0).length;
      this.onApply(nonEmptyTypeCount);
    }
  }

  /**
   * Clears the math decoration cache and forces recalculation on next render.
   * Call when editor font size or line height changes so math is re-rendered at the new size.
   */
  clearMathDecorationCache(): void {
    if (this.activeEditor) {
      this.mathDecorations.clear(this.activeEditor);
    }
    this.updateDecorationsForSelection();
  }

  /**
   * Invalidates cache for a document.
   * 
   * @private
   * @param {TextDocument} document - The document to invalidate
   */
  private invalidateCache(document: TextDocument): void {
    this.parseCache.invalidate(document);
  }

  /**
   * Clears cache for a specific document or all documents.
   * 
   * @param {string} documentUri - Optional document URI to clear, or undefined to clear all
   */
  clearCache(documentUri?: string): void {
    this.parseCache.clear(documentUri);
  }

  /**
   * Handles document change events with change tracking.
   * 
   * @param {TextDocumentChangeEvent} event - The document change event
   */
  updateDecorationsFromChange(event: TextDocumentChangeEvent): void {
    // For now, always invalidate cache and do full parse
    this.invalidateCache(event.document);

    // Update decorations with debounce
    this.updateDecorationsForDocument(event);
  }

  /**
   * Recreates the code decoration type when theme changes.
   * This ensures the background color adapts to the new theme.
   */
  /**
   * Gets the ghost faint opacity from configuration.
   * 
   * @private
   * @returns {number} Opacity value between 0.0 and 1.0
   */
  private getGhostFaintOpacity(): number {
    return config.decorations.ghostFaintOpacity();
  }

  /**
   * Gets the frontmatter delimiter opacity from configuration.
   * 
   * @private
   * @returns {number} Opacity value between 0.0 and 1.0
   */
  private getFrontmatterDelimiterOpacity(): number {
    return config.decorations.frontmatterDelimiterOpacity();
  }

  /**
   * Gets the code block language opacity from configuration.
   * 
   * @private
   * @returns {number} Opacity value between 0.0 and 1.0
   */
  private getCodeBlockLanguageOpacity(): number {
    return config.decorations.codeBlockLanguageOpacity();
  }

  recreateCodeDecorationType(): void {
    this.decorationTypes.recreateCodeDecorationType();

    // Reapply decorations with the new decoration type
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsForSelection();
    }
  }

  /**
   * Recreates all decoration types that depend on color settings or theme.
   * Called when markdownInlineEditor.colors or active color theme changes.
   */
  recreateColorDependentTypes(): void {
    this.decorationTypes.recreateColorDependentTypes();
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsForSelection();
    }
  }

  /**
   * Recreates the ghost faint decoration type with updated opacity from settings.
   * Called when the ghostFaintOpacity configuration changes.
   */
  recreateGhostFaintDecorationType(): void {
    this.decorationTypes.recreateGhostFaintDecorationType();
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsForSelection();
    }
  }

  /**
   * Recreates the frontmatter delimiter decoration type with updated opacity from settings.
   * Called when the frontmatterDelimiterOpacity configuration changes.
   */
  recreateFrontmatterDelimiterDecorationType(): void {
    this.decorationTypes.recreateFrontmatterDelimiterDecorationType();
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsForSelection();
    }
  }

  /**
   * Recreates the code block language decoration type with updated opacity from settings.
   * Called when the codeBlockLanguageOpacity configuration changes.
   */
  recreateCodeBlockLanguageDecorationType(): void {
    this.decorationTypes.recreateCodeBlockLanguageDecorationType();
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsForSelection();
    }
  }

  /**
   * Dispose of resources and clear any pending updates.
   */
  dispose() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }
    if (this.idleCallbackHandle !== undefined) {
      this.cancelIdleCallback(this.idleCallbackHandle);
      this.idleCallbackHandle = undefined;
    }
    this.pendingUpdateVersion.clear();

    this.decorationTypes.dispose();
    this.mermaidHoverIndicatorDecorationType.dispose();
  }

  /**
   * Wrapper for requestIdleCallback that falls back to setTimeout if not available.
   * 
   * VS Code extensions run in Node.js, which doesn't have requestIdleCallback.
   * This method uses setTimeout as a fallback to simulate idle behavior.
   * 
   * @private
   * @param {Function} callback - The callback to execute when idle
   * @param {Object} options - Options for requestIdleCallback
   * @returns {number} Handle for cancellation
   */
  private requestIdleCallback(callback: () => void, options?: { timeout?: number }): number {
    // VS Code runs in Node.js, use setTimeout as fallback
    // In future, if running in browser context, we could check for requestIdleCallback
    return setTimeout(callback, options?.timeout || 50) as unknown as number;
  }

  /**
   * Wrapper for cancelIdleCallback that falls back to clearTimeout if not available.
   * 
   * @private
   * @param {number} handle - The handle returned by requestIdleCallback
   */
  private cancelIdleCallback(handle: number): void {
    // VS Code runs in Node.js, use clearTimeout as fallback
    clearTimeout(handle);
  }


  /**
   * Convert character positions to VS Code Range.
   * 
   * Note: The parser normalizes line endings (CRLF -> LF) before parsing.
   * Remark's positions are based on normalized text. VS Code's positionAt()
   * uses the actual document text. We need to map normalized positions to
   * actual document positions.
   * 
   * @private
   * @param {number} startPos - Start position in normalized text
   * @param {number} endPos - End position in normalized text
   * @param {string} originalText - Original document text (for offset mapping)
   * @returns {Range | null} VS Code Range or null if invalid
   */
  private createRange(startPos: number, endPos: number, originalText?: string): Range | null {
    if (!this.activeEditor) return null;

    try {
      // Map normalized positions to original document positions
      const mappedStart = mapNormalizedToOriginal(startPos, originalText);
      const mappedEnd = mapNormalizedToOriginal(endPos, originalText);

      const start = this.activeEditor.document.positionAt(mappedStart);
      const end = this.activeEditor.document.positionAt(mappedEnd);
      return new Range(start, end);
    } catch {
      // Invalid position
      return null;
    }
  }

}
