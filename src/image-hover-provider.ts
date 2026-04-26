import * as vscode from 'vscode';
import { shouldSkipInDiffView } from './diff-context';
import { config } from './config';
import { MarkdownParseCache } from './markdown-parse-cache';
import {
  createDecorationRange,
  findDecorationAtOffset,
  isLinkDecoration,
  resolveInteractionTarget,
  toInteractionUri,
} from './link-interactions/shared';

/**
 * Provides an image preview hover for markdown image constructs.
 *
 * Shows the rendered image when hovering the image alt text (the decorated range).
 */
export class MarkdownImageHoverProvider implements vscode.HoverProvider {
  constructor(private parseCache: MarkdownParseCache) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    if (document.languageId !== 'markdown') {
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
      (candidate) => candidate.type === 'image' && isLinkDecoration(candidate)
    );
    if (!decoration) {
      return;
    }

    const target = resolveInteractionTarget(decoration, document.uri);
    if (!target) {
      return;
    }

    const targetUri = escapeHtmlAttribute(toInteractionUri(target).toString(true));
    const markdown = new vscode.MarkdownString(
      `<img src="${targetUri}" style="max-width: 400px; max-height: 300px;" />`
    );
    markdown.appendText(`\n\nImage URL: ${decoration.url}`);
    if (!singleClickEnabled) {
      markdown.appendMarkdown('\n\n*Direct click disabled (enable in settings).*');
    }
    markdown.supportHtml = true;
    const trustedTarget = toInteractionUri(target);
    markdown.isTrusted = trustedTarget.scheme === 'file' || trustedTarget.scheme === 'vscode-remote';

    return new vscode.Hover(markdown, createDecorationRange(document, decoration, text));
  }

}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
