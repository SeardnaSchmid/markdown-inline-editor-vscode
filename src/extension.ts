import * as vscode from 'vscode';
import { createNavigateToAnchorCommand } from './commands/navigate-to-anchor';
import { createToggleDecorationsCommand } from './commands/toggle-decorations';
import { config } from './config';
import { Decorator } from './decorator';
import { MarkdownParseCache } from './markdown-parse-cache';
import { MarkdownParser } from './parser';
import { disposeMermaidRenderer, initMermaidRenderer } from './mermaid/mermaid-renderer';
import { processSvg } from './mermaid/svg-processor';
import { checkRecommendedExtensions } from './recommendations';
import { registerEventHandlers } from './registration/register-event-handlers';
import { registerProviders } from './registration/register-providers';
import { disposeLogger } from './logging';

/**
 * Public API exposed via `vscode.extensions.getExtension(id).exports`.
 *
 * Intended for integration / E2E tests — allows test code to inspect the
 * parse cache and decorator without monkey-patching or modifying the source.
 */
export type ExtensionApi = {
  /** The live parse cache; call `.get(document)` to read decoration ranges. */
  parseCache: MarkdownParseCache;
  /** The live decorator instance; exposes isEnabled(), activeEditor, etc. */
  decorator: Decorator;
  /** SVG processing utilities exposed for integration tests. */
  svgProcessor: {
    processSvg: (svgString: string, height: number, maxWidth?: number) => string;
  };
};

export function activate(context: vscode.ExtensionContext): ExtensionApi {
  initMermaidRenderer(context);

  const parser = new MarkdownParser();
  const parseCache = new MarkdownParseCache(parser);
  const decorator = new Decorator(parseCache, context.workspaceState);
  decorator.updateDiffViewDecorationSetting(!config.diffView.applyDecorations());
  decorator.setActiveEditor(vscode.window.activeTextEditor);

  checkRecommendedExtensions(context);

  const { disposables: providerDisposables, linkClickHandler } = registerProviders(parseCache);
  linkClickHandler.setEnabled(config.links.singleClickOpen());

  const eventDisposables = registerEventHandlers(decorator, linkClickHandler);
  const commandDisposables = [
    createToggleDecorationsCommand(decorator),
    createNavigateToAnchorCommand(),
  ];

  context.subscriptions.push(
    ...providerDisposables,
    ...eventDisposables,
    ...commandDisposables,
    { dispose: () => decorator.dispose() },
    { dispose: () => disposeLogger() },
  );

  return { parseCache, decorator, svgProcessor: { processSvg } };
}

export function deactivate(): void {
  disposeLogger();
  disposeMermaidRenderer();
}
