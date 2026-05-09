import * as vscode from 'vscode';
import { Decorator } from './decorator';
import { MarkdownLinkProvider } from './link-provider';
import { MarkdownImageHoverProvider } from './image-hover-provider';
import { MarkdownLinkHoverProvider } from './link-hover-provider';
import { CodeBlockHoverProvider } from './code-block-hover-provider';
import { LinkClickHandler } from './link-click-handler';
import { normalizeAnchorText } from './position-mapping';
import { config } from './config';
import { MarkdownParser } from './parser';
import { MarkdownParseCache } from './markdown-parse-cache';
import { initMermaidRenderer, disposeMermaidRenderer } from './mermaid/mermaid-renderer';
import { processSvg } from './mermaid/svg-processor';

/**
 * Checks if a recommended extension is installed and optionally shows a notification.
 *
 * @param extensionId - The extension ID (e.g., 'yzhang.markdown-all-in-one')
 * @param context - The extension context for storing state
 * @param showNotification - Whether to show a notification if not installed (default: false)
 * @returns True if the extension is installed, false otherwise
 */
function checkRecommendedExtension(
  extensionId: string,
  context: vscode.ExtensionContext,
  showNotification: boolean = false
): boolean {
  const extension = vscode.extensions.getExtension(extensionId);
  const isInstalled = extension !== undefined;

  if (!isInstalled && showNotification) {
    const notificationKey = `recommendationShown.${extensionId}`;
    const hasShownBefore = context.globalState.get<boolean>(notificationKey, false);

    if (!hasShownBefore) {
      const extensionName = extensionId.split('.').pop() || extensionId;
      vscode.window.showInformationMessage(
        `Enhance your Markdown workflow: Consider installing "${extensionName}"`,
        'Install',
        'Dismiss'
      ).then((selection) => {
        if (selection === 'Install') {
          vscode.commands.executeCommand('workbench.extensions.installExtension', extensionId);
        }
        // Mark as shown regardless of user choice
        context.globalState.update(notificationKey, true);
      });
    }
  }

  return isInstalled;
}

/**
 * Checks for recommended extensions and shows notifications if needed.
 * Only shows each recommendation once per user.
 *
 * @param context - The extension context
 */
function checkRecommendedExtensions(context: vscode.ExtensionContext): void {
  // List of recommended extension IDs
  const recommendedExtensions = [
    'yzhang.markdown-all-in-one',
    'MermaidChart.vscode-mermaid-chart'
  ];

  // Check each extension (notifications are shown only once per extension)
  recommendedExtensions.forEach((extensionId) => {
    checkRecommendedExtension(extensionId, context, true);
  });
}

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

/**
 * Activates the markdown inline preview extension.
 *
 * This function is called by VS Code when the extension is activated (typically
 * when a markdown file is opened). It sets up event listeners for:
 * - Active editor changes
 * - Text selection changes
 * - Document content changes
 *
 * All event subscriptions are registered with the extension context for proper
 * cleanup when the extension is deactivated.
 *
 * @param {vscode.ExtensionContext} context - The extension context provided by VS Code
 *
 * @example
 * // Called automatically by VS Code when extension is activated
 * activate(context);
 */
export function activate(context: vscode.ExtensionContext): ExtensionApi {
  // Initialize mermaid renderer with extension context
  initMermaidRenderer(context);

  const parser = new MarkdownParser();
  const parseCache = new MarkdownParseCache(parser);
  const decorator = new Decorator(parseCache, context.workspaceState);
  const diffViewApplyDecorations = config.diffView.applyDecorations();
  decorator.updateDiffViewDecorationSetting(!diffViewApplyDecorations);

  decorator.setActiveEditor(vscode.window.activeTextEditor);

  // Check for recommended extensions (shows notifications if not installed)
  checkRecommendedExtensions(context);

  // Register link provider for clickable markdown links
  const linkProvider = new MarkdownLinkProvider(parseCache);
  const linkProviderDisposable = vscode.languages.registerDocumentLinkProvider(
    { language: 'markdown', scheme: 'file' },
    linkProvider
  );

  // Register hover provider for image previews on hover
  const imageHoverProvider = new MarkdownImageHoverProvider(parseCache);
  const imageHoverProviderDisposable = vscode.languages.registerHoverProvider(
    { language: 'markdown', scheme: 'file' },
    imageHoverProvider
  );

  // Register hover provider for link URL previews
  const linkHoverProvider = new MarkdownLinkHoverProvider(parseCache);
  const linkHoverProviderDisposable = vscode.languages.registerHoverProvider(
    { language: 'markdown', scheme: 'file' },
    linkHoverProvider
  );

  // Register hover provider for code block previews (Mermaid, LaTeX, etc.)
  const codeBlockHoverProvider = new CodeBlockHoverProvider(parseCache);
  const codeBlockHoverProviderDisposable = vscode.languages.registerHoverProvider(
    { language: 'markdown', scheme: 'file' },
    codeBlockHoverProvider
  );

  // Setup single-click link handler (configurable)
  const linkClickHandler = new LinkClickHandler(parseCache);
  const singleClickEnabled = config.links.singleClickOpen();
  linkClickHandler.setEnabled(singleClickEnabled);

  // Register command for toggling markdown decorations
  const toggleDecorationsCommand = vscode.commands.registerCommand(
    'mdInline.toggleDecorations',
    () => {
      const enabled = decorator.toggleDecorations();
      const fileName = decorator.activeEditor
        ? vscode.workspace.asRelativePath(decorator.activeEditor.document.uri)
        : 'this file';
      vscode.window.showInformationMessage(
        `Markdown decorations ${enabled ? 'enabled' : 'disabled'} for ${fileName}`
      );
    }
  );

  // Register command for navigating to anchor links
  const navigateToAnchorCommand = vscode.commands.registerCommand(
    'markdown-inline-editor.navigateToAnchor',
    async (anchor: string, documentUri: string) => {
      const uri = vscode.Uri.parse(documentUri);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      // Find the heading with this anchor
      const text = document.getText();
      const lines = text.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if this line is a heading that matches the anchor
        const headingMatch = line.match(/^#+\s+(.+)$/);
        if (headingMatch) {
          const headingText = normalizeAnchorText(headingMatch[1]);

          if (headingText === anchor) {
            // Navigate to this line
            const position = new vscode.Position(i, 0);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(position, position);
            return;
          }
        }
      }

      // If not found, show a message
      vscode.window.showInformationMessage(`Anchor "${anchor}" not found`);
    }
  );

  const changeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
    decorator.setActiveEditor(editor);
  });

  const changeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection((event) => {
    decorator.updateDecorationsForSelection(event.kind);
  });

  const changeDocument = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document === vscode.window.activeTextEditor?.document) {
      decorator.updateDecorationsFromChange(event);
    }
  });

  const renameFiles = vscode.workspace.onDidRenameFiles((event) => {
    for (const { oldUri, newUri } of event.files) {
      decorator.renameFile(oldUri.toString(), newUri.toString());
    }
  });

  const changeConfiguration = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("markdownInlineEditor.tables.styleHeaders")) {
      decorator.clearCache();
      decorator.updateDecorationsForSelection();
    }

    if (event.affectsConfiguration('markdownInlineEditor.defaultBehaviors.diffView.applyDecorations')) {
      const diffViewApplyDecorations = config.diffView.applyDecorations();
      decorator.updateDiffViewDecorationSetting(!diffViewApplyDecorations);
      decorator.updateDecorationsForSelection();
    }

    if (event.affectsConfiguration('markdownInlineEditor.decorations.ghostFaintOpacity')) {
      decorator.recreateGhostFaintDecorationType();
    }

    if (event.affectsConfiguration('markdownInlineEditor.decorations.frontmatterDelimiterOpacity')) {
      decorator.recreateFrontmatterDelimiterDecorationType();
    }

    if (event.affectsConfiguration('markdownInlineEditor.decorations.codeBlockLanguageOpacity')) {
      decorator.recreateCodeBlockLanguageDecorationType();
    }

    if (event.affectsConfiguration('markdownInlineEditor.links.singleClickOpen')) {
      const singleClickEnabled = config.links.singleClickOpen();
      linkClickHandler.setEnabled(singleClickEnabled);
    }

    if (event.affectsConfiguration('markdownInlineEditor.colors')) {
      decorator.recreateColorDependentTypes();
    }

    if (event.affectsConfiguration('editor.fontSize') || event.affectsConfiguration('editor.lineHeight')) {
      decorator.clearMathDecorationCache();
    }
  });

  // Listen for theme changes to update code and color-dependent decoration types
  const changeColorTheme = vscode.window.onDidChangeActiveColorTheme(() => {
    decorator.recreateColorDependentTypes();
  });

  context.subscriptions.push(changeActiveTextEditor);
  context.subscriptions.push(changeTextEditorSelection);
  context.subscriptions.push(changeDocument);
  context.subscriptions.push(renameFiles);
  context.subscriptions.push(changeConfiguration);
  context.subscriptions.push(changeColorTheme);
  context.subscriptions.push(linkProviderDisposable);
  context.subscriptions.push(imageHoverProviderDisposable);
  context.subscriptions.push(linkHoverProviderDisposable);
  context.subscriptions.push(codeBlockHoverProviderDisposable);
  context.subscriptions.push(toggleDecorationsCommand);
  context.subscriptions.push(navigateToAnchorCommand);
  context.subscriptions.push({ dispose: () => decorator.dispose() });
  context.subscriptions.push({ dispose: () => linkClickHandler.dispose() });

  return { parseCache, decorator, svgProcessor: { processSvg } };
}

/**
 * Deactivates the markdown inline preview extension.
 *
 * This function is called by VS Code when the extension is deactivated.
 * It properly disposes of all event subscriptions and cleans up resources.
 *
 * @param {vscode.ExtensionContext} context - The extension context provided by VS Code
 *
 * @example
 * // Called automatically by VS Code when extension is deactivated
 * deactivate(context);
 */
export function deactivate(): void {
  // Dispose mermaid renderer webview
  disposeMermaidRenderer();
  // VS Code disposes subscriptions automatically on deactivation.
}
