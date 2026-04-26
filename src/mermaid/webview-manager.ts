import * as vscode from 'vscode';
import { ColorThemeKind } from 'vscode';
import type { PendingRender, RenderResponse } from './types';
import { MERMAID_CONSTANTS } from './constants';
import { createErrorSvg } from './error-handler';
import { logWarn } from '../logging';

/**
 * Manages the Mermaid webview lifecycle and communication
 */
export class MermaidWebviewManager {
  private webviewView: vscode.WebviewView | undefined;
  private webviewLoaded: Promise<void>;
  private resolveWebviewLoaded: (() => void) | undefined;
  private pendingRenders = new Map<string, PendingRender>();
  private renderRequestCounter = 0;
  private messageHandlerDisposable: vscode.Disposable | undefined;
  private initTimeoutId: NodeJS.Timeout | undefined;
  private _extensionContext: vscode.ExtensionContext | undefined;

  constructor() {
    this.webviewLoaded = new Promise<void>((resolve) => {
      this.resolveWebviewLoaded = resolve;
    });
  }

  /**
   * Get the extension context (for use by webview provider)
   */
  get extensionContext(): vscode.ExtensionContext | undefined {
    return this._extensionContext;
  }

  /**
   * Initialize the webview manager with extension context
   */
  initialize(context: vscode.ExtensionContext): void {
    this._extensionContext = context;

    // Register the webview view provider
    const provider = new MermaidWebviewViewProvider(this);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        MermaidWebviewViewProvider.viewType,
        provider,
        { webviewOptions: { retainContextWhenHidden: true } }
      )
    );

    // Open the mermaid view briefly to initialize it, then switch back
    // Focus the view so VS Code calls resolveWebviewView() (hidden views are not resolved by opening the container only)
    void this.ensureWebviewThenSwitchBack();
  }

  /**
   * Focus the Mermaid view to trigger webview creation, wait for it (or 5s), then switch back to Explorer.
   */
  private ensureWebviewThenSwitchBack(): void {
    const WEBVIEW_READY_TIMEOUT_MS = 5000;
    const SWITCH_BACK_DELAY_MS = 100;

    vscode.commands
      .executeCommand('mdInline.mermaidRenderer.focus')
      .then(
        () => {
          // Wait for webview to be ready or timeout, then switch back
          Promise.race([
            this.webviewLoaded,
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), WEBVIEW_READY_TIMEOUT_MS)
            ),
          ])
            .then(() => {
              this.initTimeoutId = setTimeout(() => {
                vscode.commands.executeCommand('workbench.view.explorer');
                this.initTimeoutId = undefined;
              }, SWITCH_BACK_DELAY_MS);
            })
            .catch((err: unknown) => {
              if (err instanceof Error && err.message === 'timeout') {
                logWarn('Mermaid: Webview not ready after opening view');
              }
              this.initTimeoutId = setTimeout(() => {
                vscode.commands.executeCommand('workbench.view.explorer');
                this.initTimeoutId = undefined;
              }, SWITCH_BACK_DELAY_MS);
            });
        },
        (err: unknown) => {
          if (err !== undefined) {
            logWarn('Mermaid: Failed to focus view', err);
          }
        }
      );
  }

  /**
   * Set the webview view instance
   */
  setWebviewView(view: vscode.WebviewView): void {
    this.webviewView = view;
    // Resolve webviewLoaded immediately when webview is created
    this.resolveWebviewLoaded?.();
  }

  /**
   * Get the webview HTML content
   */
  getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Use local Mermaid bundle (no internet required)
    const mermaidScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'assets', 'mermaid', 'mermaid.esm.min.mjs')
    );
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 20px;
      line-height: 1.6;
    }
    .info-box {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .info-box h3 {
      margin-top: 0;
      color: var(--vscode-textLink-foreground);
    }
    .info-box p {
      margin: 8px 0;
      color: var(--vscode-descriptionForeground);
    }
    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="info-box">
    <h3>Mermaid Diagram Renderer</h3>
    <p>This webview is used internally by the Markdown Inline Editor extension to render Mermaid diagrams inline in your markdown files.</p>
    <p><strong>You can safely ignore this view.</strong> It runs in the background and has no user-facing functionality. The diagrams appear directly in your editor, not here.</p>
    <p>If you're seeing this view, you can close it and return to your editor. The extension will continue to work normally.</p>
  </div>
  <div id="renderContainer" class="hidden"></div>
  <script type="module">
    import mermaid from '${mermaidScriptUri}';
    
    const vscode = acquireVsCodeApi();

    function getDiagramType(source) {
      const firstNonEmptyLine = source
        .split(/\\r?\\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      if (!firstNonEmptyLine) return 'unknown';
      return firstNonEmptyLine.split(/\\s+/)[0] || 'unknown';
    }

    
    window.addEventListener('message', async (event) => {
      const data = event.data;
      
      if (!data || !data.source) {
        return;
      }

      const requestId = data.requestId;
      const diagramType = getDiagramType(data.source);
      
      try {
        // Initialize Mermaid with theme and font settings
        mermaid.initialize({
          theme: data.darkMode ? 'dark' : 'default',
          fontFamily: data.fontFamily || undefined,
          startOnLoad: false,
          securityLevel: 'strict',
        });
        // Render the diagram - Mermaid v11 returns { svg } from render()
        // Gantt depends on parentElement.offsetWidth; when webview layout width is 0,
        // create a hidden container with explicit width to give Mermaid a real layout width.
        let svg;
        let renderContainer;
        // Use timestamp + random to ensure unique render IDs (prevents conflicts with concurrent renders)
        const renderId = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        
        if (diagramType === 'gantt') {
          renderContainer = document.createElement('div');
          renderContainer.style.position = 'absolute';
          renderContainer.style.left = '-10000px';
          renderContainer.style.top = '0';
          renderContainer.style.width = '2000px';
          renderContainer.style.height = '1px';
          renderContainer.style.visibility = 'hidden';
          document.body?.appendChild(renderContainer);
        }

        try {
          // Only pass container parameter if it exists (Mermaid v11 supports optional container)
          // Passing undefined explicitly might cause issues, so conditionally call render
          const result = renderContainer
            ? await mermaid.render(renderId, data.source, renderContainer)
            : await mermaid.render(renderId, data.source);
          svg = result.svg;
        } finally {
          // Always clean up container if it was created
          if (renderContainer) {
            renderContainer.remove();
          }
        }
        
        // Send SVG string back with requestId to match to correct pending render
        vscode.postMessage({ svg, requestId });
      } catch (error) {
        // Send detailed error information back with requestId
        const errorInfo = {
          message: error?.message || 'Unknown error',
          name: error?.name || 'Error',
          stack: error?.stack || '',
          toString: error?.toString?.() || String(error)
        };
        // Include full error details - prioritize message, fallback to toString
        const errorMessage = errorInfo.message || errorInfo.toString || 'Unknown error occurred';
        vscode.postMessage({ error: errorMessage, requestId });
      }
    });
    
    // Signal ready after mermaid is loaded
    vscode.postMessage({ ready: true });
  </script>
</body>
</html>`;
  }

  /**
   * Handle messages from the webview
   */
  handleWebviewMessage(message: RenderResponse): void {
    // Ignore "ready" messages - we don't need them anymore
    if (message && message.ready) {
      return;
    }

    if (message && message.error) {
      const requestId = message.requestId;
      if (requestId && this.pendingRenders.has(requestId)) {
        const { resolve, timeoutId } = this.pendingRenders.get(requestId)!;
        // Clear timeout since we're handling the error
        clearTimeout(timeoutId);
        // Create a proper error SVG - height will be adjusted in getMermaidDecoration
        const isDark = vscode.window.activeColorTheme.kind === ColorThemeKind.Dark ||
          vscode.window.activeColorTheme.kind === ColorThemeKind.HighContrast;
        const errorSvg = createErrorSvg(
          message.error,
          400, // Default width - will be resized later
          200, // Default height - will be resized later
          isDark
        );
        resolve(errorSvg);
        this.pendingRenders.delete(requestId);
      }
      return;
    }

    // Handle SVG response (with requestId) or legacy string format
    if (message && message.requestId && this.pendingRenders.has(message.requestId)) {
      const requestId = message.requestId;
      const { resolve, timeoutId } = this.pendingRenders.get(requestId)!;
      // Clear timeout since we received the response
      clearTimeout(timeoutId);
      // message.svg should always be present for RenderResponse with requestId
      const svg = message.svg || '';
      resolve(svg);
      this.pendingRenders.delete(requestId);
      return;
    }

    // Legacy support: string message without requestId (for backwards compatibility)
    if (typeof message === 'string') {
      // If there's only one pending render, use it (backwards compatibility)
      if (this.pendingRenders.size === 1) {
        const [requestId, { resolve, timeoutId }] = Array.from(this.pendingRenders.entries())[0];
        clearTimeout(timeoutId);
        resolve(message);
        this.pendingRenders.delete(requestId);
      }
    }
  }

  /**
   * Set the message handler disposable for cleanup
   */
  setMessageHandlerDisposable(disposable: vscode.Disposable): void {
    this.messageHandlerDisposable?.dispose();
    this.messageHandlerDisposable = disposable;
  }

  /**
   * Request SVG rendering with timeout and optional cancellation
   */
  async requestSvg(
    data: { source: string; darkMode: boolean; fontFamily?: string },
    timeoutMs: number = MERMAID_CONSTANTS.REQUEST_TIMEOUT_MS,
    cancellationToken?: vscode.CancellationToken
  ): Promise<string> {
    if (!this.webviewView) {
      throw new Error('Webview not available');
    }

    // Generate unique request ID for this render
    const requestId = `req-${Date.now()}-${++this.renderRequestCounter}`;

    // Create promise BEFORE posting message (like Markless pattern)
    // Track pending renders in a Map to handle concurrent requests
    return new Promise<string>((resolve, reject) => {
      if (!this.webviewView) {
        reject(new Error('Webview not available'));
        return;
      }
      
      // Check cancellation token before starting
      if (cancellationToken?.isCancellationRequested) {
        reject(new vscode.CancellationError());
        return;
      }
      
      // Set up cancellation listener if token provided
      let cancellationListener: vscode.Disposable | undefined;
      if (cancellationToken) {
        cancellationListener = cancellationToken.onCancellationRequested(() => {
          if (this.pendingRenders.has(requestId)) {
            const { timeoutId } = this.pendingRenders.get(requestId)!;
            clearTimeout(timeoutId);
            this.pendingRenders.delete(requestId);
            cancellationListener?.dispose();
            reject(new vscode.CancellationError());
          }
        });
      }
      
      // Set up timeout to prevent promise leaks from failed requests
      const timeoutId = setTimeout(() => {
        if (this.pendingRenders.has(requestId)) {
          this.pendingRenders.delete(requestId);
          cancellationListener?.dispose();
          reject(new Error('Mermaid render request timed out'));
        }
      }, timeoutMs);
      
      // Wrap resolve/reject to clear timeout and cancellation listener
      const wrappedResolve = (value: string) => {
        clearTimeout(timeoutId);
        cancellationListener?.dispose();
        resolve(value);
      };
      
      const wrappedReject = (error: Error) => {
        clearTimeout(timeoutId);
        cancellationListener?.dispose();
        reject(error);
      };
      
      // Store resolve/reject with timeout ID in Map
      this.pendingRenders.set(requestId, { 
        resolve: wrappedResolve, 
        reject: wrappedReject,
        timeoutId 
      });

      try {
        // Include requestId in message so webview can send it back
        this.webviewView.webview.postMessage({ ...data, requestId });
      } catch (error) {
        // Clean up on error
        clearTimeout(timeoutId);
        cancellationListener?.dispose();
        this.pendingRenders.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Wait for webview to be loaded
   */
  async waitForWebview(): Promise<void> {
    await this.webviewLoaded;
    if (!this.webviewView) {
      throw new Error('Failed to create mermaid webview');
    }
  }

  /**
   * Dispose and clean up resources
   */
  dispose(): void {
    // Clear timeout if still pending
    if (this.initTimeoutId) {
      clearTimeout(this.initTimeoutId);
      this.initTimeoutId = undefined;
    }
    
    // Clear all pending render timeouts and reject promises
    for (const { reject, timeoutId } of this.pendingRenders.values()) {
      clearTimeout(timeoutId);
      reject(new Error('Mermaid renderer disposed'));
    }
    this.pendingRenders.clear();
    
    // Dispose message handler subscription
    this.messageHandlerDisposable?.dispose();
    this.messageHandlerDisposable = undefined;
    
    // Clear webview reference
    this.webviewView = undefined;
    this.resolveWebviewLoaded = undefined;
  }
}

/**
 * Webview view provider for Mermaid rendering
 */
class MermaidWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'mdInline.mermaidRenderer';

  constructor(private manager: MermaidWebviewManager) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    if (!this.manager.extensionContext) {
      return;
    }
    
    const extensionContext = this.manager.extensionContext;
    
    // Dispose previous message handler if exists (prevent memory leak on webview recreation)
    const previousDisposable = this.manager['messageHandlerDisposable'];
    previousDisposable?.dispose();
    
    // Configure webview to allow access to local assets
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionContext.extensionUri, 'assets')
      ]
    };
    
    webviewView.webview.html = this.manager.getWebviewContent(webviewView.webview, extensionContext.extensionUri);

    // Store reference BEFORE setting up handlers (like Markless does)
    this.manager.setWebviewView(webviewView);
    
    // Handle messages from the webview - store disposable for cleanup
    const messageHandlerDisposable = webviewView.webview.onDidReceiveMessage((message) => {
      this.manager.handleWebviewMessage(message);
    }, null, []);
    
    this.manager.setMessageHandlerDisposable(messageHandlerDisposable);
  }
}
