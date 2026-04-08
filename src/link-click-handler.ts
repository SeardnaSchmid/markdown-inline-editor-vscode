import * as vscode from "vscode";
import { MarkdownParseCache } from "./markdown-parse-cache";
import {
  findDecorationAtOffset,
  isLinkLikeDecoration,
  resolveInteractionTarget,
  toInteractionUri,
} from "./link-interactions/shared";
import { logWarn } from "./logging";

/**
 * Handles single-click navigation for markdown links and images.
 *
 * When enabled, allows single-click to open links/images without requiring Ctrl+Click.
 * This provides a more intuitive web-browser-like experience, but can interfere with
 * text selection, so it's configurable and disabled by default.
 */
export class LinkClickHandler {
  private disposables: vscode.Disposable[] = [];
  private isEnabled: boolean = false;

  constructor(private parseCache: MarkdownParseCache) {}

  /**
   * Enables or disables single-click link navigation.
   *
   * @param enabled - Whether single-click navigation is enabled
   */
  setEnabled(enabled: boolean): void {
    if (this.isEnabled === enabled) {
      return;
    }

    this.isEnabled = enabled;
    this.dispose();

    if (enabled) {
      this.setupClickHandler();
    }
  }

  /**
   * Sets up the mouse click handler for single-click navigation.
   */
  private setupClickHandler(): void {
    // Listen for text editor mouse clicks
    const clickDisposable = vscode.window.onDidChangeTextEditorSelection(
      (event) => {
        // Only handle if it's a single click (no selection, no modifier keys)
        // We detect this by checking if the selection is empty and the kind is 'mouse'
        if (
          event.kind === vscode.TextEditorSelectionChangeKind.Mouse &&
          event.selections.length === 1 &&
          event.selections[0].isEmpty
        ) {
          this.handleClick(event.textEditor, event.selections[0].active);
        }
      },
    );

    this.disposables.push(clickDisposable);
  }

  /**
   * Handles a click on the editor to check if it's on a link/image and open it.
   *
   * @param editor - The text editor
   * @param position - The clicked position
   */
  private async handleClick(
    editor: vscode.TextEditor,
    position: vscode.Position,
  ): Promise<void> {
    if (!this.isEnabled || editor.document.languageId !== "markdown") {
      return;
    }

    const document = editor.document;
    const parseEntry = this.parseCache.get(document);
    const text = parseEntry.text;
    const decorations = parseEntry.decorations;
    const clickOffset = document.offsetAt(position);
    const decoration = findDecorationAtOffset(
      decorations,
      text,
      clickOffset,
      document,
      isLinkLikeDecoration
    );
    if (!decoration) {
      return;
    }

    const target = resolveInteractionTarget(decoration, document.uri);
    if (!target) {
      return;
    }

    try {
      if (target.kind === 'command') {
        await vscode.commands.executeCommand(target.command, ...target.args);
        return;
      }
      await vscode.commands.executeCommand("vscode.open", toInteractionUri(target));
    } catch (error) {
      logWarn('Failed to open link', error);
    }
  }

  /**
   * Disposes of all event listeners.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
