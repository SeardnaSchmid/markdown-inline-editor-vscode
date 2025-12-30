import { Range, TextEditor, TextDocument, TextDocumentChangeEvent, workspace, Position, WorkspaceEdit, Selection, TextEditorSelectionChangeKind } from 'vscode';
import {
  HideDecorationType,
  BoldDecorationType,
  ItalicDecorationType,
  BoldItalicDecorationType,
  StrikethroughDecorationType,
  CodeDecorationType,
  CodeBlockDecorationType,
  HeadingDecorationType,
  Heading1DecorationType,
  Heading2DecorationType,
  Heading3DecorationType,
  Heading4DecorationType,
  Heading5DecorationType,
  Heading6DecorationType,
  LinkDecorationType,
  ImageDecorationType,
  BlockquoteDecorationType,
  ListItemDecorationType,
  HorizontalRuleDecorationType,
  CheckboxUncheckedDecorationType,
  CheckboxCheckedDecorationType,
} from './decorations';
import { MarkdownParser, DecorationRange, DecorationType } from './parser';

/**
 * Cache entry for document decorations.
 */
interface CacheEntry {
  version: number;
  decorations: DecorationRange[];
  text: string;
  lastAccessed: number;
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
 * const decorator = new Decorator();
 * decorator.setActiveEditor(vscode.window.activeTextEditor);
 * // Decorations are automatically updated when the editor content changes
 */
export class Decorator {
  /** The currently active text editor being decorated */
  activeEditor: TextEditor | undefined;

  private parser = new MarkdownParser();
  private updateTimeout: NodeJS.Timeout | undefined;

  /** Cache for parsed decorations, keyed by document URI */
  private decorationCache = new Map<string, CacheEntry>();

  /** Maximum number of documents to cache (LRU eviction) */
  private readonly maxCacheSize = 10;

  /** Access counter for LRU eviction */
  private accessCounter = 0;

  /** Pending update batching: track last document version that triggered an update */
  private pendingUpdateVersion = new Map<string, number>();

  /** requestIdleCallback handle for idle updates */
  private idleCallbackHandle: number | undefined;

  /** Whether decorations are enabled or disabled */
  private decorationsEnabled = true;

  /** Whether to hide decorations that intersect with cursor/selection */
  private cursorDisables: boolean = true;

  /** Whether to expand selection to full lines before hiding intersecting decorations */
  private cursorLineDisables: boolean = true;

  /** Maximum character offset to consider a hide decoration as being at line start (for heading detection) */
  private readonly MAX_HEADING_MARKER_OFFSET = 10;

  private hideDecorationType = HideDecorationType();
  private boldDecorationType = BoldDecorationType();
  private italicDecorationType = ItalicDecorationType();
  private boldItalicDecorationType = BoldItalicDecorationType();
  private strikethroughDecorationType = StrikethroughDecorationType();
  private codeDecorationType = CodeDecorationType();
  private codeBlockDecorationType = CodeBlockDecorationType();
  private headingDecorationType = HeadingDecorationType();
  private heading1DecorationType = Heading1DecorationType();
  private heading2DecorationType = Heading2DecorationType();
  private heading3DecorationType = Heading3DecorationType();
  private heading4DecorationType = Heading4DecorationType();
  private heading5DecorationType = Heading5DecorationType();
  private heading6DecorationType = Heading6DecorationType();
  private linkDecorationType = LinkDecorationType();
  private imageDecorationType = ImageDecorationType();
  private blockquoteDecorationType = BlockquoteDecorationType();
  private listItemDecorationType = ListItemDecorationType();
  private horizontalRuleDecorationType = HorizontalRuleDecorationType();
  private checkboxUncheckedDecorationType = CheckboxUncheckedDecorationType();
  private checkboxCheckedDecorationType = CheckboxCheckedDecorationType();

  constructor() {
    // Initialize configuration on construction
    this.updateCursorConfigInternal();
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
    this.updateCursorConfigInternal();

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
    if (kind === TextEditorSelectionChangeKind.Mouse && this.handleCheckboxClick()) {
      return;
    }

    // Immediate update without debounce for selection changes
    this.updateDecorationsInternal();
  }

  /**
   * Handles checkbox toggle when user clicks inside [ ] or [x].
   * Detects if cursor is positioned inside a checkbox and toggles it.
   *
   * @returns true if a checkbox was toggled, false otherwise
   */
  private handleCheckboxClick(): boolean {
    if (!this.activeEditor) return false;

    const selection = this.activeEditor.selection;

    // Only handle single cursor clicks (no selection range)
    if (!selection.isEmpty) return false;

    const document = this.activeEditor.document;
    const line = document.lineAt(selection.active.line);
    const cursorChar = selection.active.character;

    // Find checkbox pattern on this line: [ ] or [x] or [X]
    const checkboxRegex = /\[([ xX])\]/g;
    let match: RegExpExecArray | null;

    while ((match = checkboxRegex.exec(line.text)) !== null) {
      const bracketStart = match.index;
      const bracketEnd = match.index + 3; // [ ] is 3 chars

      // Check if cursor is on or inside the checkbox [ ] range
      // Include bracketStart because clicking the ☐ decoration lands cursor there
      if (cursorChar >= bracketStart && cursorChar <= bracketEnd) {
        const currentState = match[1];
        const newState = currentState === ' ' ? 'x' : ' ';

        // Toggle the checkbox
        const edit = new WorkspaceEdit();
        const charPosition = new Position(selection.active.line, bracketStart + 1);
        edit.replace(
          document.uri,
          new Range(charPosition, charPosition.translate(0, 1)),
          newState
        );

        workspace.applyEdit(edit);

        // Move cursor after the checkbox to avoid re-triggering
        const newCursorPos = new Position(selection.active.line, bracketEnd + 1);
        this.activeEditor.selection = new Selection(newCursorPos, newCursorPos);

        return true;
      }
    }
    return false;
  }

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
    // 1. Short timeout for responsive feedback (150ms)
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
      }, { timeout: 300 }); // Force execution after 300ms max
    }, 150);
  }

  /**
   * Legacy method for backward compatibility.
   * Delegates to updateDecorationsForSelection() for immediate updates.
   * 
   * @deprecated Use updateDecorationsForSelection() or updateDecorationsForDocument() instead
   * @param {boolean} immediate - If true, update immediately
   */
  updateDecorations(immediate: boolean = false) {
    if (immediate) {
      this.updateDecorationsForSelection();
    } else {
      this.updateDecorationsForDocument();
    }
  }

  /**
   * Toggle decorations on/off.
   * 
   * @returns {boolean} The new state (true = enabled, false = disabled)
   */
  toggleDecorations(): boolean {
    this.decorationsEnabled = !this.decorationsEnabled;

    if (this.decorationsEnabled) {
      // Re-enable: update decorations immediately
      this.updateDecorationsForSelection();
    } else {
      // Disable: clear all decorations
      this.clearAllDecorations();
    }

    return this.decorationsEnabled;
  }

  /**
   * Check if decorations are currently enabled.
   * 
   * @returns {boolean} True if decorations are enabled
   */
  isEnabled(): boolean {
    return this.decorationsEnabled;
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
    for (const decorationType of this.decorationTypeMap.values()) {
      this.activeEditor.setDecorations(decorationType, []);
    }
  }

  /**
   * Internal method that performs the actual decoration update.
   * This orchestrates parsing, filtering, and application.
   */
  private updateDecorationsInternal() {
    if (!this.activeEditor) {
      return;
    }

    // Early exit if decorations are disabled
    if (!this.decorationsEnabled) {
      return;
    }

    // Early exit for non-markdown files
    if (!this.isMarkdownDocument()) {
      return;
    }

    const document = this.activeEditor.document;

    // Parse document (uses cache if version unchanged)
    const decorations = this.parseDocument(document);

    // Re-validate version before applying (race condition protection)
    if (this.isDocumentStale(document)) {
      return; // Document changed during parse, skip this update
    }

    // Get original document text for offset adjustment (use cached if available for consistency)
    const cacheKey = document.uri.toString();
    const cached = this.decorationCache.get(cacheKey);
    const originalText = cached?.text || document.getText();

    // Filter decorations based on selections (pass original text for offset adjustment)
    const filtered = this.filterDecorations(decorations, originalText);

    // Apply decorations
    this.applyDecorations(filtered);
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
    return ['markdown', 'md', 'mdx'].includes(this.activeEditor.document.languageId);
  }

  /**
   * Checks if document version has changed since cache was created (stale check).
   * 
   * @private
   * @param {TextDocument} document - The document to check
   * @returns {boolean} True if document is stale
   */
  private isDocumentStale(document: TextDocument): boolean {
    const cacheKey = document.uri.toString();
    const cached = this.decorationCache.get(cacheKey);
    if (!cached) {
      return false; // No cache, not stale
    }
    return cached.version !== document.version;
  }

  /**
   * Parses the document and returns decoration ranges.
   * Uses cache if document version is unchanged.
   * 
   * @private
   * @param {TextDocument} document - The document to parse
   * @returns {DecorationRange[]} Array of decoration ranges
   */
  private parseDocument(document: TextDocument): DecorationRange[] {
    const cacheKey = document.uri.toString();
    const cached = this.getCachedDecorations(document);

    if (cached !== null) {
      // Update access time for LRU
      const entry = this.decorationCache.get(cacheKey);
      if (entry) {
        entry.lastAccessed = ++this.accessCounter;
      }
      return cached;
    }

    // Parse document
    const documentText = document.getText();
    const decorations = this.parser.extractDecorations(documentText);

    // Cache the result
    this.setCachedDecorations(document, decorations, documentText);

    return decorations;
  }

  /**
   * Checks if a decoration type is a heading decoration (heading1-6 or generic heading).
   * 
   * @private
   * @param {DecorationType} type - The decoration type to check
   * @returns {boolean} True if the type is a heading decoration
   */
  private isHeadingDecorationType(type: DecorationType): boolean {
    return type === 'heading' || 
      type === 'heading1' || type === 'heading2' ||
      type === 'heading3' || type === 'heading4' ||
      type === 'heading5' || type === 'heading6';
  }

  /**
   * Finds all line numbers that contain heading decorations.
   * 
   * @private
   * @param {DecorationRange[]} decorations - All decorations to search
   * @param {string} originalText - Original document text (for offset adjustment)
   * @returns {Set<number>} Set of line numbers that contain headings
   */
  private findHeadingLines(decorations: DecorationRange[], originalText: string): Set<number> {
    const headingLines = new Set<number>();
    
    for (const decoration of decorations) {
      if (this.isHeadingDecorationType(decoration.type)) {
        const range = this.createRange(decoration.startPos, decoration.endPos, originalText);
        if (range) {
          headingLines.add(range.start.line);
        }
      }
    }
    
    return headingLines;
  }

  /**
   * Finds line numbers that contain headings and are within the selection.
   * 
   * @private
   * @param {DecorationRange[]} decorations - All decorations to search
   * @param {Selection} selection - The effective selection to check
   * @param {string} originalText - Original document text (for offset adjustment)
   * @returns {Set<number>} Set of selected line numbers that contain headings
   */
  private findSelectedHeadingLines(
    decorations: DecorationRange[], 
    selection: Selection, 
    originalText: string
  ): Set<number> {
    const headingLines = this.findHeadingLines(decorations, originalText);
    const selectedHeadingLines = new Set<number>();
    
    // Check if selection is on any heading lines
    for (let line = selection.start.line; line <= selection.end.line; line++) {
      if (headingLines.has(line)) {
        selectedHeadingLines.add(line);
      }
    }
    
    return selectedHeadingLines;
  }

  /**
   * Checks if a hide decoration is for a heading marker (#).
   * 
   * This identifies hide decorations that hide the '#' characters at the start of headings.
   * When a heading line is selected, we want to show these markers.
   * 
   * @private
   * @param {Range} range - The range of the hide decoration
   * @param {number} lineNumber - The line number to check
   * @returns {boolean} True if this hide decoration is for a heading marker
   */
  private isHeadingMarkerHideDecoration(range: Range, lineNumber: number): boolean {
    if (!this.activeEditor) return false;
    
    const lineText = this.activeEditor.document.lineAt(lineNumber).text;
    const trimmedLine = lineText.trim();
    const isAtLineStart = range.start.character <= this.MAX_HEADING_MARKER_OFFSET;
    
    // Check if line starts with '#' and decoration is at the start (accounting for indentation)
    return trimmedLine.startsWith('#') && isAtLineStart;
  }

  /**
   * Determines if a decoration should be skipped (not applied) for a selected heading line.
   * 
   * When a heading line is selected:
   * - Hide decorations for heading markers (#) should be skipped (to show the marker)
   * - Heading font-size decorations should be skipped (to return to normal size)
   * - Other decorations should be applied normally
   * 
   * @private
   * @param {DecorationRange} decoration - The decoration to check
   * @param {Range} range - The range of the decoration
   * @returns {boolean} True if the decoration should be skipped
   */
  private shouldSkipDecorationForSelectedHeading(decoration: DecorationRange, range: Range): boolean {
    // Show heading marker (#) by skipping the hide decoration
    if (decoration.type === 'hide') {
      return this.isHeadingMarkerHideDecoration(range, range.start.line);
    }
    
    // Hide font-size decorations to return to normal font size
    if (this.isHeadingDecorationType(decoration.type)) {
      return true;
    }
    
    // Keep other decorations (bold, italic, etc.) - don't skip them
    return false;
  }

  /**
   * Filters decorations based on current selections and groups by type.
   * 
   * Implements intersection-based filtering:
   * - Uses first selection only
   * - Optionally expands selection to full lines (cursorLineDisables)
   * - Uses intersection-based filtering (cursorDisables)
   * - Preserves checkbox toggle functionality
   * - Special handling for heading lines: shows # marker and hides font-size when selected
   * 
   * @private
   * @param {DecorationRange[]} decorations - Decorations to filter
   * @param {string} originalText - Original document text (for offset adjustment)
   * @returns {Map<DecorationType, Range[]>} Filtered decorations grouped by type
   */
  private filterDecorations(decorations: DecorationRange[], originalText: string): Map<DecorationType, Range[]> {
    if (!this.activeEditor) {
      return new Map();
    }

    // Get first selection only
    if (this.activeEditor.selections.length === 0) {
      return new Map();
    }
    let effectiveSelection = this.activeEditor.selections[0];

    // Expand selection to full lines if cursorLineDisables is enabled
    if (this.cursorLineDisables) {
      effectiveSelection = this.expandSelectionToLines(effectiveSelection);
    }

    // Get cursor positions for checkbox special handling
    // Note: We check all selections for cursor positions (for checkbox toggle),
    // but only use first selection for decoration filtering
    const cursorPositions: Position[] = [];
    for (const selection of this.activeEditor.selections) {
      if (selection.isEmpty) {
        cursorPositions.push(selection.start);
      }
    }

    // Identify selected lines that contain headings
    // This is used to show heading markers (#) and hide font-size decorations when selected
    const selectedHeadingLines = this.cursorDisables
      ? this.findSelectedHeadingLines(decorations, effectiveSelection, originalText)
      : new Set<number>();

    // Group decorations by type using Map
    const filtered = new Map<DecorationType, Range[]>();

    for (const decoration of decorations) {
      const range = this.createRange(decoration.startPos, decoration.endPos, originalText);
      if (!range) continue;

      // Special handling for checkbox decorations:
      // - Keep checkbox visible when clicking on it (for toggle functionality)
      // - Show raw markdown when clicking elsewhere on the line
      const isCheckbox = decoration.type === 'checkboxChecked' || decoration.type === 'checkboxUnchecked';
      
      if (isCheckbox) {
        // Check if cursor is within the checkbox range - if so, keep it visible
        const cursorInCheckbox = cursorPositions.some(pos => 
          pos.line === range.start.line && 
          pos.character >= range.start.character && 
          pos.character <= range.end.character
        );
        
        if (cursorInCheckbox) {
          // Keep checkbox visible when clicking on it
          const ranges = filtered.get(decoration.type) || [];
          ranges.push(range);
          filtered.set(decoration.type, ranges);
          continue;
        }
      }

      // Special handling for heading lines when selected:
      // - Show the heading marker (#) by revealing the 'hide' decoration
      // - Hide the font-size decorations (heading1-6, 'heading') to return to normal size
      // - Keep other decorations (bold, italic, etc.) applied
      if (selectedHeadingLines.has(range.start.line)) {
        if (this.shouldSkipDecorationForSelectedHeading(decoration, range)) {
          continue;
        }
      }
      
      // Apply cursorDisables filter (intersection-based check)
      // Uses selection.intersection(range) which is bidirectional:
      // - Returns undefined if no overlap
      // - Returns Range if they overlap (even if cursor is at start/end boundary)
      // This handles both empty selections (cursor) and non-empty selections
      if (this.cursorDisables) {
        const intersection = effectiveSelection.intersection(range);
        if (intersection !== undefined) {
          // Hide decoration if it intersects with selection
          continue;
        }
      }

      // Add to appropriate type array
      const ranges = filtered.get(decoration.type) || [];
      ranges.push(range);
      filtered.set(decoration.type, ranges);
    }

    return filtered;
  }

  /** Mapping of decoration types to their VS Code decoration instances */
  private decorationTypeMap = new Map<DecorationType, any>([
    ['hide', this.hideDecorationType],
    ['bold', this.boldDecorationType],
    ['italic', this.italicDecorationType],
    ['boldItalic', this.boldItalicDecorationType],
    ['strikethrough', this.strikethroughDecorationType],
    ['code', this.codeDecorationType],
    ['codeBlock', this.codeBlockDecorationType],
    ['heading', this.headingDecorationType],
    ['heading1', this.heading1DecorationType],
    ['heading2', this.heading2DecorationType],
    ['heading3', this.heading3DecorationType],
    ['heading4', this.heading4DecorationType],
    ['heading5', this.heading5DecorationType],
    ['heading6', this.heading6DecorationType],
    ['link', this.linkDecorationType],
    ['image', this.imageDecorationType],
    ['blockquote', this.blockquoteDecorationType],
    ['listItem', this.listItemDecorationType],
    ['horizontalRule', this.horizontalRuleDecorationType],
    ['checkboxUnchecked', this.checkboxUncheckedDecorationType],
    ['checkboxChecked', this.checkboxCheckedDecorationType],
  ]);

  /**
   * Applies filtered decorations to the editor.
   * 
   * @private
   * @param {Map<DecorationType, Range[]>} filteredDecorations - Decorations grouped by type
   */
  private applyDecorations(filteredDecorations: Map<DecorationType, Range[]>) {
    if (!this.activeEditor) {
      return;
    }

    // Apply all decorations by iterating through the type map
    for (const [type, decorationType] of this.decorationTypeMap.entries()) {
      this.activeEditor.setDecorations(decorationType, filteredDecorations.get(type) || []);
    };
  }

  /**
   * Gets cached decorations for a document if version matches.
   * 
   * @private
   * @param {TextDocument} document - The document to get cache for
   * @returns {DecorationRange[] | null} Cached decorations or null if cache miss/version mismatch
   */
  private getCachedDecorations(document: TextDocument): DecorationRange[] | null {
    const cacheKey = document.uri.toString();
    const cached = this.decorationCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check version match
    if (cached.version !== document.version) {
      return null;
    }

    return cached.decorations;
  }

  /**
   * Sets cached decorations for a document.
   * Implements LRU eviction if cache is full.
   * 
   * @private
   * @param {TextDocument} document - The document to cache
   * @param {DecorationRange[]} decorations - Decorations to cache
   * @param {string} text - Document text to cache
   */
  private setCachedDecorations(document: TextDocument, decorations: DecorationRange[], text: string): void {
    const cacheKey = document.uri.toString();

    // Evict least recently used if cache is full
    if (this.decorationCache.size >= this.maxCacheSize && !this.decorationCache.has(cacheKey)) {
      this.evictLRU();
    }

    this.decorationCache.set(cacheKey, {
      version: document.version,
      decorations,
      text,
      lastAccessed: ++this.accessCounter,
    });
  }

  /**
   * Evicts the least recently used cache entry.
   * 
   * @private
   */
  private evictLRU(): void {
    let lruKey: string | undefined;
    let lruAccess = Infinity;

    for (const [key, entry] of this.decorationCache.entries()) {
      if (entry.lastAccessed < lruAccess) {
        lruAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.decorationCache.delete(lruKey);
    }
  }

  /**
   * Invalidates cache for a document.
   * 
   * @private
   * @param {TextDocument} document - The document to invalidate
   */
  private invalidateCache(document: TextDocument): void {
    const cacheKey = document.uri.toString();
    this.decorationCache.delete(cacheKey);
  }

  /**
   * Clears cache for a specific document or all documents.
   * 
   * @param {string} documentUri - Optional document URI to clear, or undefined to clear all
   */
  clearCache(documentUri?: string): void {
    if (documentUri) {
      this.decorationCache.delete(documentUri);
    } else {
      this.decorationCache.clear();
    }
  }

  /**
   * Handles document change events with change tracking.
   * 
   * @param {TextDocumentChangeEvent} event - The document change event
   */
  updateDecorationsFromChange(event: TextDocumentChangeEvent): void {
    // For now, always invalidate cache and do full parse
    // Future: could use calculateChangeSize to determine if incremental parsing is feasible
    this.invalidateCache(event.document);

    // Update decorations with debounce
    this.updateDecorationsForDocument(event);
  }

  /**
   * Calculates the percentage of document changed.
   * 
   * @private
   * @param {TextDocumentChangeEvent} event - The document change event
   * @returns {number} Percentage of document changed (0-100)
   */
  private calculateChangeSize(event: TextDocumentChangeEvent): number {
    const document = event.document;
    const totalLength = document.getText().length;

    if (totalLength === 0) {
      return 0;
    }

    let changedLength = 0;
    for (const change of event.contentChanges) {
      const deletedLength = change.rangeLength;
      const insertedLength = change.text.length;
      changedLength += Math.max(deletedLength, insertedLength);
    }

    return (changedLength / totalLength) * 100;
  }

  /**
   * Updates cached cursor configuration values from workspace settings.
   * 
   * Caches configuration to avoid repeated workspace API calls during filtering.
   * 
   * @private
   */
  private updateCursorConfigInternal(): void {
    const config = workspace.getConfiguration('mdInline');
    this.cursorDisables = config.get<boolean>('cursorDisables', true);
    this.cursorLineDisables = config.get<boolean>('cursorLineDisables', true);
  }

  /**
   * Public method to update cursor configuration and refresh decorations.
   * Called when configuration changes to update cached values and refresh the UI.
   */
  updateCursorConfig(): void {
    this.updateCursorConfigInternal();
    if (this.activeEditor) {
      this.updateDecorationsForSelection();
    }
  }

  /**
   * Expands a selection to include the full lines it spans.
   * 
   * When cursorLineDisables is enabled, this expands the selection to full lines
   * before applying intersection-based filtering.
   * 
   * @private
   * @param {Selection} selection - The selection to expand
   * @returns {Selection} A new selection expanded to full lines, or original selection if expansion fails
   */
  private expandSelectionToLines(selection: Selection): Selection {
    if (!this.activeEditor) return selection;
    
    try {
      // Use Position directly to get line information
      const lineStart = this.activeEditor.document.lineAt(selection.start);
      const lineEnd = this.activeEditor.document.lineAt(selection.end);
      return new Selection(lineStart.range.start, lineEnd.range.end);
    } catch (error) {
      // If lineAt fails (e.g., invalid line numbers), return original selection
      console.warn('Failed to expand selection to lines:', error);
      return selection;
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
    this.decorationCache.clear();
    this.pendingUpdateVersion.clear();
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
   * Maps a position from normalized text (LF only) to original document text.
   * This accounts for CRLF -> LF normalization done by the parser.
   * 
   * @private
   * @param {number} normalizedPos - Position in normalized text
   * @param {string} originalText - Original document text
   * @returns {number} Position in original document text
   */
  private mapNormalizedToOriginal(normalizedPos: number, originalText?: string): number {
    if (!originalText) {
      return normalizedPos;
    }

    // If no CRLF, positions match exactly
    if (!originalText.includes('\r\n')) {
      return normalizedPos;
    }

    // Build a direct character-by-character mapping
    // Walk through original text character by character, tracking normalized index
    // When normalized index reaches target, return the corresponding original position
    // 
    // Key insight: For exclusive end positions, when normalized position points to '\n',
    // we want to map to the '\r' position (not '\n') so that the content range excludes '\r'
    // This ensures [start:end) in normalized maps to [start:end) in original with same content
    let normalizedIndex = 0;

    for (let i = 0; i < originalText.length; i++) {
      // Check for CRLF first
      if (originalText[i] === '\r' && i + 1 < originalText.length && originalText[i + 1] === '\n') {
        // CRLF: '\r' is skipped in normalized, '\n' maps to normalized position
        // If target is at the normalized '\n' position, return '\r' position (i)
        // This ensures exclusive end positions work correctly
        if (normalizedIndex === normalizedPos) {
          // Target points to '\n' in normalized, map to '\r' in original
          return i;
        }
        // Advance normalized index by 1 (for the single '\n' in normalized)
        normalizedIndex++;
        i++; // Skip the '\n' in original
        // Continue to next iteration - don't check here, let the loop handle it
      } else {
        // Regular character: check if this is our target before incrementing
        if (normalizedIndex === normalizedPos) {
          return i;
        }
        normalizedIndex++;
      }
    }

    // If we didn't find it (shouldn't happen), return the last position
    return originalText.length;
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
      const mappedStart = this.mapNormalizedToOriginal(startPos, originalText);
      const mappedEnd = this.mapNormalizedToOriginal(endPos, originalText);

      const start = this.activeEditor.document.positionAt(mappedStart);
      const end = this.activeEditor.document.positionAt(mappedEnd);
      return new Range(start, end);
    } catch {
      // Invalid position
      return null;
    }
  }

  /**
   * Check if a decoration range intersects with any selection
   * Returns true if the decoration range overlaps with any selection range
   * 
   * Edge cases handled:
   * - Empty selections (cursor): only hides if cursor is within the decoration range
   * - Multiple selections: checks all selections
   * - Partial overlaps: any intersection hides the decoration
   * - Touching ranges: considered as overlapping
   * 
   * @param {Range} range - The decoration range to check
   * @param {Range[]} selectedRanges - Pre-computed non-empty selection ranges
   */
  private isRangeSelected(range: Range, selectedRanges: Range[]): boolean {
    if (!this.activeEditor) return false;

    // Check empty selections (cursors) - these need to be checked against the current editor state
    for (const selection of this.activeEditor.selections) {
      if (selection.isEmpty && range.contains(selection.start)) {
        return true;
      }
    }

    // Check non-empty selections using pre-computed ranges
    return selectedRanges.some((selection) => {
      // intersection() returns undefined if ranges don't overlap, or a Range if they do
      // If intersection exists (even if empty/touching), the ranges overlap
      const intersection = range.intersection(selection);
      return intersection !== undefined;
    });
  }

  /**
   * Check if any line containing the decoration has a selection or cursor
   * This hides decorations when the user clicks anywhere on a line (even without selecting)
   * to show raw markdown syntax for the entire line
   * 
   * This is more permissive than isRangeSelected - it hides decorations on any line
   * that has any selection/cursor, even if the selection doesn't overlap the decoration
   * 
   * @param {Range} range - The decoration range to check
   * @param {Set<number>} selectedLines - Pre-computed set of selected line numbers
   */
  private isLineOfRangeSelected(range: Range, selectedLines: Set<number>): boolean {
    if (!this.activeEditor || selectedLines.size === 0) return false;

    // Check if any line in the decoration range is in the selected lines set
    for (let line = range.start.line; line <= range.end.line; line++) {
      if (selectedLines.has(line)) {
        return true;
      }
    }

    return false;
  }
}