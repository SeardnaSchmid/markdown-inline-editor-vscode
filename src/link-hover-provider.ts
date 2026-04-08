import * as vscode from "vscode";
import { shouldSkipInDiffView } from "./diff-context";
import { config } from "./config";
import { MarkdownParseCache } from "./markdown-parse-cache";
import {
  createDecorationRange,
  findDecorationAtOffset,
  getInteractionDisplayValue,
  isLinkLikeDecoration,
  resolveInteractionTarget,
} from "./link-interactions/shared";

/**
 * Provides a hover that shows the target URL for markdown links, mentions, and issue references.
 */
export class MarkdownLinkHoverProvider implements vscode.HoverProvider {
  constructor(private parseCache: MarkdownParseCache) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Hover> {
    if (document.languageId !== "markdown") {
      return;
    }

    if (shouldSkipInDiffView(document)) {
      return;
    }

    if (token.isCancellationRequested) {
      return;
    }

    const parseEntry = this.parseCache.get(document);
    const text = parseEntry.text;
    if (token.isCancellationRequested) {
      return;
    }
    const decorations = parseEntry.decorations;
    const hoverOffset = document.offsetAt(position);
    const singleClickEnabled = config.links.singleClickOpen();
    const decoration = findDecorationAtOffset(
      decorations,
      text,
      hoverOffset,
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

    const markdown = new vscode.MarkdownString();
    markdown.appendText(`Link URL: ${getInteractionDisplayValue(decoration, target)}`);
    if (!singleClickEnabled) {
      markdown.appendMarkdown(
        "\n\n*Direct click disabled (enable in settings).*",
      );
    }

    return new vscode.Hover(
      markdown,
      createDecorationRange(document, decoration, text)
    );
  }
}
