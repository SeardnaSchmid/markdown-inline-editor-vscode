import { DecorationOptions, Range, TextEditor, TextDocument, TextDocumentChangeEvent, window, TextEditorSelectionChangeKind, Memento } from 'vscode';
import { DecorationRange, DecorationType, MermaidBlock, MathRegion, ScopeRange } from './parser';
import { config } from './config';
import { isDiffLikeUri, isDiffViewVisible } from './diff-context';
import { MarkdownParseCache } from './markdown-parse-cache';
import {
  applyFilteredDecorations,
  buildScopeEntries,
  clearAppliedDecorationCache,
  createRange as createEditorRange,
  isSelectionOrCursorInsideOffsets as selectionIntersectsOffsets,
} from './decorator/editor-decoration-applier';
import { FileDecorationStateStore } from './decorator/file-decoration-state';
import { MermaidUpdateCoordinator } from './decorator/mermaid-update-coordinator';
import { DecorationTypeRegistry } from './decorator/decoration-type-registry';
import { filterDecorationsForEditor, ScopeEntry } from './decorator/visibility-model';
import { handleCheckboxClick } from './decorator/checkbox-toggle';
import { MermaidDiagramDecorations } from './decorator/mermaid-diagram-decorations';
import { DecoratorUpdateScheduler } from './decorator/update-scheduler';
import { MathDecorations } from './math/math-decorations';
import { MermaidHoverIndicatorDecorationType } from './decorations';
import { isSupportedMarkdownLanguage } from './language-support';
import { logDebug, logPerformanceMetric } from './logging';
import { applyMathDecorationsForEditor } from './decorator/math-region-application';

/**
 * Performance and caching constants.
 */
const PERFORMANCE_CONSTANTS = {
  DEBOUNCE_TIMEOUT_MS: 150,
  IDLE_CALLBACK_TIMEOUT_MS: 300,
  MERMAID_MAX_CONCURRENCY: 4,
} as const;


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

  /** Whether to skip decorations in diff views (inverse of applyDecorations setting) */
  private skipDecorationsInDiffView = true;

  private decorationTypes: DecorationTypeRegistry;
  private mermaidDecorations = new MermaidDiagramDecorations();
  private readonly mermaidCoordinator = new MermaidUpdateCoordinator(
    this.mermaidDecorations,
    PERFORMANCE_CONSTANTS.MERMAID_MAX_CONCURRENCY
  );
  private mathDecorations = new MathDecorations();
  private mermaidHoverIndicatorDecorationType = MermaidHoverIndicatorDecorationType();
  private readonly fileDecorationState: FileDecorationStateStore;
  private readonly updateScheduler: DecoratorUpdateScheduler;
  private scopeEntriesCache:
    | { uri: string; version: number; entries: ScopeEntry[] }
    | undefined;
  private lastSelectionIntersectsAsyncBlocks = false;

  constructor(parseCache: MarkdownParseCache, workspaceState?: Memento) {
    this.parseCache = parseCache;
    this.fileDecorationState = new FileDecorationStateStore(workspaceState);
    this.updateScheduler = new DecoratorUpdateScheduler(
      PERFORMANCE_CONSTANTS.DEBOUNCE_TIMEOUT_MS,
      PERFORMANCE_CONSTANTS.IDLE_CALLBACK_TIMEOUT_MS
    );
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
      getLinkShowEmoji: () => config.links.showEmoji(),
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
    this.updateScheduler.cancel();

    if (!textEditor) {
      return;
    }

    this.activeEditor = textEditor;
    this.lastSelectionIntersectsAsyncBlocks = false;

    // Full refresh when switching editors (Mermaid/math must render for the new file)
    this.updateDecorationsInternal();
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

    // Lightweight path: re-filter cached decorations, skip Mermaid/math unless needed
    this.updateDecorationsForSelectionInternal();
  }

  /**
   * Full decoration refresh (parse if needed, Mermaid, math).
   * Use after config or theme changes, not for cursor/selection moves.
   */
  refreshDecorations(): void {
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

    // Invalidate cache on document change
    if (event) {
      this.invalidateCache(document);
    }
    this.updateScheduler.schedule(document, () => {
      this.updateDecorationsInternal();
    });
  }

  /**
   * Toggle decorations on/off.
   * 
   * @returns {boolean} The new state (true = enabled, false = disabled)
   */
  toggleDecorations(): boolean {
    const uri = this.activeEditor?.document.uri.toString();
    if (!uri) { return true; }

    const next = this.fileDecorationState.toggle(uri);

    if (next) {
      this.updateDecorationsInternal();
    } else {
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
    return this.fileDecorationState.isEnabled(uri);
  }

  /**
   * Migrate toggle state when a file is renamed.
   *
   * @param {string} oldUri - The old file URI string
   * @param {string} newUri - The new file URI string
   */
  renameFile(oldUri: string, newUri: string): void {
    this.fileDecorationState.renameFile(oldUri, newUri);
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

    clearAppliedDecorationCache(this.activeEditor.document.uri.toString());
    this.scopeEntriesCache = undefined;
    this.lastSelectionIntersectsAsyncBlocks = false;

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
   * Lightweight update for selection/cursor moves when document content is unchanged.
   * Re-filters cached decorations and skips Mermaid/math unless the selection
   * enters or leaves an async-rendered block.
   */
  private updateDecorationsForSelectionInternal(): void {
    const context = this.prepareDecorationUpdate();
    if (!context) {
      return;
    }

    const { document, version, decorations, scopes, text, mermaidBlocks, mathRegions } = context;
    const cycleStart = Date.now();
    const filtered = this.filterDecorations(decorations, scopes, text);
    const filterDurationMs = Date.now() - cycleStart;

    this.applyDecorations(filtered);

    const intersectsAsyncBlocks = this.selectionIntersectsAsyncBlocks(
      mermaidBlocks,
      mathRegions,
      text
    );
    const asyncBlocksUpdated = intersectsAsyncBlocks || this.lastSelectionIntersectsAsyncBlocks;
    if (asyncBlocksUpdated) {
      if (config.math.enabled() && mathRegions.length > 0) {
        this.applyMathDecorations(mathRegions, text);
      } else if (this.activeEditor) {
        this.mathDecorations.clear(this.activeEditor);
      }
      void this.updateMermaidDiagrams(mermaidBlocks, text, version);
    }
    this.lastSelectionIntersectsAsyncBlocks = intersectsAsyncBlocks;

    if (config.debug.performanceEnabled()) {
      logPerformanceMetric('decorator.update.selection', {
        uri: document.uri.toString(),
        version,
        filterMs: filterDurationMs,
        totalMs: Date.now() - cycleStart,
        decorations: decorations.length,
        scopes: scopes.length,
        asyncBlocksUpdated: asyncBlocksUpdated,
      });
    }
  }

  /**
   * Full decoration update after document changes or when async blocks must refresh.
   */
  private updateDecorationsInternal(): void {
    const context = this.prepareDecorationUpdate();
    if (!context) {
      return;
    }

    const { document, version, decorations, scopes, text, mermaidBlocks, mathRegions, parseDurationMs } =
      context;
    const cycleStart = Date.now();
    const filtered = this.filterDecorations(decorations, scopes, text);
    const filterDurationMs = Date.now() - cycleStart;

    this.applyDecorations(filtered, true);
    if (config.math.enabled() && mathRegions.length > 0) {
      this.applyMathDecorations(mathRegions, text);
    } else if (this.activeEditor) {
      this.mathDecorations.clear(this.activeEditor);
    }
    void this.updateMermaidDiagrams(mermaidBlocks, text, version);
    this.lastSelectionIntersectsAsyncBlocks = this.selectionIntersectsAsyncBlocks(
      mermaidBlocks,
      mathRegions,
      text
    );

    if (config.debug.performanceEnabled()) {
      logPerformanceMetric('decorator.update', {
        uri: document.uri.toString(),
        version,
        parseMs: parseDurationMs,
        filterMs: filterDurationMs,
        totalMs: Date.now() - cycleStart,
        decorations: decorations.length,
        scopes: scopes.length,
        mermaidBlocks: mermaidBlocks.length,
        mathRegions: mathRegions.length,
        filteredDecorationTypes: filtered.size,
      });
    }
  }

  private prepareDecorationUpdate():
    | {
        document: TextDocument;
        version: number;
        decorations: DecorationRange[];
        scopes: ScopeEntry[];
        text: string;
        mermaidBlocks: MermaidBlock[];
        mathRegions: MathRegion[];
        parseDurationMs: number;
      }
    | undefined {
    if (!this.activeEditor) {
      return undefined;
    }

    const document = this.activeEditor.document;

    if (!this.isEnabledForUri(document.uri.toString())) {
      logDebug('skip decoration update for disabled file', { uri: document.uri.toString() });
      return undefined;
    }

    if (!this.isMarkdownDocument()) {
      return undefined;
    }

    if (this.skipDecorationsInDiffView && this.isDiffEditor()) {
      logDebug('skip decoration update in diff view', { uri: document.uri.toString() });
      this.clearAllDecorations();
      return undefined;
    }

    const parseStart = Date.now();
    const version = document.version;
    const parsed = this.parseDocument(document);
    const parseDurationMs = Date.now() - parseStart;

    if (document.version !== version) {
      logDebug('skip stale decoration update', {
        uri: document.uri.toString(),
        scheduledVersion: version,
        currentVersion: document.version,
      });
      return undefined;
    }

    return {
      document,
      version,
      parseDurationMs,
      ...parsed,
    };
  }

  private selectionIntersectsAsyncBlocks(
    mermaidBlocks: MermaidBlock[],
    mathRegions: MathRegion[],
    text: string
  ): boolean {
    if (!this.activeEditor) {
      return false;
    }

    const { selections, document } = this.activeEditor;

    for (const block of mermaidBlocks) {
      if (selectionIntersectsOffsets(block.startPos, block.endPos, text, selections, document)) {
        return true;
      }
    }

    if (config.math.enabled()) {
      for (const region of mathRegions) {
        if (selectionIntersectsOffsets(region.startPos, region.endPos, text, selections, document)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Applies math decorations for inline and block regions using normalized positions.
   * When selection or cursor intersects a math region, that region is shown raw (range passed as null).
   */
  private applyMathDecorations(mathRegions: MathRegion[], normalizedText: string): void {
    if (!this.activeEditor) return;
    applyMathDecorationsForEditor(
      this.activeEditor,
      mathRegions,
      normalizedText,
      this.mathDecorations
    );
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
    return isSupportedMarkdownLanguage(this.activeEditor.document.languageId);
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
    const uri = document.uri.toString();
    let scopeEntries: ScopeEntry[];

    if (
      this.scopeEntriesCache &&
      this.scopeEntriesCache.uri === uri &&
      this.scopeEntriesCache.version === document.version
    ) {
      scopeEntries = this.scopeEntriesCache.entries;
    } else {
      scopeEntries = this.buildScopeEntries(entry.scopes, entry.text);
      this.scopeEntriesCache = {
        uri,
        version: document.version,
        entries: scopeEntries,
      };
    }

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
    await this.mermaidCoordinator.update(
      editor,
      mermaidBlocks,
      text,
      documentVersion,
      this.mermaidHoverIndicatorDecorationType
    );
  }

  private isSelectionOrCursorInsideOffsets(
    startPos: number,
    endPos: number,
    text: string,
    selections: readonly Range[],
    document: TextDocument
  ): boolean {
    return selectionIntersectsOffsets(startPos, endPos, text, selections, document);
  }

  /**
   * Builds scope entries from parser-emitted scope ranges.
   */
  private buildScopeEntries(scopes: ScopeRange[], originalText: string): ScopeEntry[] {
    return buildScopeEntries(this.activeEditor, scopes, originalText);
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
  private applyDecorations(
    filteredDecorations: Map<DecorationType, Array<Range | DecorationOptions>>,
    force = false
  ) {
    if (!this.activeEditor) {
      return;
    }
    applyFilteredDecorations(
      this.activeEditor,
      filteredDecorations,
      this.decorationTypes,
      this.onApply,
      force
    );
  }

  /**
   * Clears the math decoration cache and forces recalculation on next render.
   * Call when editor font size or line height changes so math is re-rendered at the new size.
   */
  clearMathDecorationCache(): void {
    if (this.activeEditor) {
      this.mathDecorations.clear(this.activeEditor);
    }
    this.updateDecorationsInternal();
  }

  /**
   * Invalidates cache for a document.
   * 
   * @private
   * @param {TextDocument} document - The document to invalidate
   */
  private invalidateCache(document: TextDocument): void {
    this.parseCache.invalidate(document);
    if (this.scopeEntriesCache?.uri === document.uri.toString()) {
      this.scopeEntriesCache = undefined;
    }
    clearAppliedDecorationCache(document.uri.toString());
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
    clearAppliedDecorationCache(this.activeEditor?.document.uri.toString());

    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsInternal();
    }
  }

  /**
   * Recreates link decoration (underline + optional chain icon) when link emoji setting changes.
   */
  recreateLinkDecorationType(): void {
    this.decorationTypes.recreateLinkDecorationType();
    clearAppliedDecorationCache(this.activeEditor?.document.uri.toString());
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsInternal();
    }
  }

  /**
   * Recreates all decoration types that depend on color settings or theme.
   * Called when markdownInlineEditor.colors or active color theme changes.
   */
  recreateColorDependentTypes(): void {
    this.decorationTypes.recreateColorDependentTypes();
    clearAppliedDecorationCache(this.activeEditor?.document.uri.toString());
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsInternal();
    }
  }

  /**
   * Recreates the ghost faint decoration type with updated opacity from settings.
   * Called when the ghostFaintOpacity configuration changes.
   */
  recreateGhostFaintDecorationType(): void {
    this.decorationTypes.recreateGhostFaintDecorationType();
    clearAppliedDecorationCache(this.activeEditor?.document.uri.toString());
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsInternal();
    }
  }

  /**
   * Recreates the frontmatter delimiter decoration type with updated opacity from settings.
   * Called when the frontmatterDelimiterOpacity configuration changes.
   */
  recreateFrontmatterDelimiterDecorationType(): void {
    this.decorationTypes.recreateFrontmatterDelimiterDecorationType();
    clearAppliedDecorationCache(this.activeEditor?.document.uri.toString());
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsInternal();
    }
  }

  /**
   * Recreates the code block language decoration type with updated opacity from settings.
   * Called when the codeBlockLanguageOpacity configuration changes.
   */
  recreateCodeBlockLanguageDecorationType(): void {
    this.decorationTypes.recreateCodeBlockLanguageDecorationType();
    clearAppliedDecorationCache(this.activeEditor?.document.uri.toString());
    if (this.activeEditor && this.isMarkdownDocument()) {
      this.updateDecorationsInternal();
    }
  }

  /**
   * Dispose of resources and clear any pending updates.
   */
  dispose() {
    this.updateScheduler.dispose();
    this.decorationTypes.dispose();
    this.mermaidHoverIndicatorDecorationType.dispose();
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
    return this.activeEditor
      ? createEditorRange(this.activeEditor, startPos, endPos, originalText)
      : null;
  }

}
