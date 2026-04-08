import * as vscode from 'vscode';
import { CodeBlockHoverProvider } from '../code-block-hover-provider';
import { MarkdownImageHoverProvider } from '../image-hover-provider';
import { MarkdownLinkHoverProvider } from '../link-hover-provider';
import { LinkClickHandler } from '../link-click-handler';
import { MarkdownLinkProvider } from '../link-provider';
import { MarkdownParseCache } from '../markdown-parse-cache';
import { FILE_BACKED_MARKDOWN_SELECTOR } from '../language-support';

export type ProviderRegistration = {
  disposables: vscode.Disposable[];
  linkClickHandler: LinkClickHandler;
};

export function registerProviders(parseCache: MarkdownParseCache): ProviderRegistration {
  const linkClickHandler = new LinkClickHandler(parseCache);

  return {
    linkClickHandler,
    disposables: [
      vscode.languages.registerDocumentLinkProvider(
        FILE_BACKED_MARKDOWN_SELECTOR,
        new MarkdownLinkProvider(parseCache)
      ),
      vscode.languages.registerHoverProvider(
        FILE_BACKED_MARKDOWN_SELECTOR,
        new MarkdownImageHoverProvider(parseCache)
      ),
      vscode.languages.registerHoverProvider(
        FILE_BACKED_MARKDOWN_SELECTOR,
        new MarkdownLinkHoverProvider(parseCache)
      ),
      vscode.languages.registerHoverProvider(
        FILE_BACKED_MARKDOWN_SELECTOR,
        new CodeBlockHoverProvider(parseCache)
      ),
      { dispose: () => linkClickHandler.dispose() },
    ],
  };
}
