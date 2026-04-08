import * as vscode from 'vscode';
import { LRUCache } from '../utils/lru-cache';
import { MermaidWebviewManager } from './webview-manager';
import { processSvg } from './svg-processor';
import { createErrorSvg, extractErrorMessage } from './error-handler';
import { MERMAID_CONSTANTS } from './constants';
import type { MermaidRenderOptions } from './types';
import { logWarn } from '../logging';

// Singleton webview manager instance
let webviewManager: MermaidWebviewManager | undefined;

// Memoization cache for decorations
// Bounded LRU to prevent unbounded memory growth for large/edited documents.
const decorationCache = new LRUCache<string, Promise<string>>(MERMAID_CONSTANTS.DECORATION_CACHE_MAX_ENTRIES);

// Log "waiting for webview" at most once per session to avoid spam when webview is never created
let hasLoggedWaitingForWebview = false;

async function waitForWebviewOnceLogged(manager: MermaidWebviewManager): Promise<void> {
  if (!hasLoggedWaitingForWebview) {
    hasLoggedWaitingForWebview = true;
    logWarn('Mermaid: waiting for webview');
  }
  await manager.waitForWebview();
}

/**
 * Initialize the Mermaid renderer with extension context
 */
export function initMermaidRenderer(context: vscode.ExtensionContext): void {
  if (webviewManager) {
    // Already initialized
    return;
  }
  
  webviewManager = new MermaidWebviewManager();
  webviewManager.initialize(context);
}

/**
 * Render Mermaid SVG at natural size (without height constraints)
 * Used to get actual diagram dimensions for hover sizing
 * @param source - Mermaid diagram source code
 * @param options - Rendering options including theme and fontFamily
 * @param cancellationToken - Optional cancellation token for hover requests (shorter timeout)
 */
export async function renderMermaidSvgNatural(
  source: string,
  options: { theme: 'default' | 'dark'; fontFamily?: string },
  cancellationToken?: vscode.CancellationToken
): Promise<string> {
  if (!webviewManager) {
    throw new Error('Mermaid renderer not initialized. Call initMermaidRenderer first.');
  }

  await waitForWebviewOnceLogged(webviewManager);

  const darkMode = options.theme === 'dark';
  
  // Check cancellation before starting expensive operation
  if (cancellationToken?.isCancellationRequested) {
    throw new vscode.CancellationError();
  }
  
  // Use shorter timeout for hover requests (5 seconds) to match VS Code's hover timeout
  // Regular requests use the default 30-second timeout
  const timeoutMs = cancellationToken ? MERMAID_CONSTANTS.HOVER_REQUEST_TIMEOUT_MS : MERMAID_CONSTANTS.REQUEST_TIMEOUT_MS;
  
  // Request SVG without processing (get natural dimensions)
  const svgString = await webviewManager.requestSvg(
    { source, darkMode, fontFamily: options.fontFamily },
    timeoutMs,
    cancellationToken
  );
  
  // Check cancellation again after await (in case it was cancelled during the request)
  if (cancellationToken?.isCancellationRequested) {
    throw new vscode.CancellationError();
  }
  
  // Return raw SVG without height processing
  return svgString;
}

/**
 * Memoized function to get Mermaid decoration
 * Caches based on source, theme, fontFamily, and height
 * Uses the global decorationCache to avoid creating unbounded caches
 */
function memoizeMermaidDecoration(
  func: (source: string, darkMode: boolean, height: number, fontFamily?: string, maxWidth?: number) => Promise<string>
): (source: string, darkMode: boolean, height: number, fontFamily?: string, maxWidth?: number) => Promise<string> {
  return (source: string, darkMode: boolean, height: number, fontFamily?: string, maxWidth?: number): Promise<string> => {
    const key = `${source}|${darkMode}|${height}|${fontFamily ?? ''}|${maxWidth ?? ''}`;
    const cached = decorationCache.get(key);
    if (cached) {
      return cached;
    }

    const promise = func(source, darkMode, height, fontFamily, maxWidth);
    decorationCache.set(key, promise);
    // If a render fails (timeout, disposal, transient issues), don't pin the failure in cache.
    promise.catch(() => {
      decorationCache.delete(key);
    });
    return promise;
  };
}

const getMermaidDecoration = memoizeMermaidDecoration(async (
  source: string,
  darkMode: boolean,
  height: number,
  fontFamily?: string,
  maxWidth?: number
): Promise<string> => {
  if (!webviewManager) {
    throw new Error('Mermaid renderer not initialized. Call initMermaidRenderer first.');
  }

  await waitForWebviewOnceLogged(webviewManager);

  const svgString = await webviewManager.requestSvg(
    { source, darkMode, fontFamily },
    MERMAID_CONSTANTS.REQUEST_TIMEOUT_MS
  );
  
  // Check if this is an error SVG (contains "Mermaid Rendering Error")
  if (svgString.includes('Mermaid Rendering Error')) {
    // Recreate error SVG with proper dimensions
    const errorSvg = createErrorSvg(
      extractErrorMessage(svgString) || 'Rendering failed',
      Math.max(400, height * 2), // Width based on height
      height,
      darkMode
    );
    return errorSvg;
  }
  
  const processedSvg = processSvg(svgString, height, maxWidth);
  
  return processedSvg;
});

/**
 * Render Mermaid SVG for decoration display
 * @param source - Mermaid diagram source code
 * @param options - Rendering options including theme, fontFamily, numLines, and height
 */
export async function renderMermaidSvg(
  source: string,
  options: MermaidRenderOptions & { numLines?: number }
): Promise<string> {
  if (!webviewManager) {
    throw new Error('Mermaid renderer not initialized. Call initMermaidRenderer first.');
  }

  await waitForWebviewOnceLogged(webviewManager);

  const darkMode = options.theme === 'dark';
  // Calculate height based on line count (like Markless: (numLines + 2) * lineHeight)
  // Default to 200px if numLines not provided
  const editorConfig = vscode.workspace.getConfiguration('editor');
  const fontSize = editorConfig.get<number>('fontSize', 14);
  let lineHeight = editorConfig.get<number>('lineHeight', 0);

  // If lineHeight is 0 or invalid, calculate from fontSize (like Markless does)
  if (lineHeight === 0 || lineHeight < 8) {
    // Use platform-appropriate multiplier (Markless uses 1.5 for macOS, 1.35 for others)
    const multiplier = process.platform === 'darwin' ? 1.5 : 1.35;
    lineHeight = Math.round(multiplier * fontSize);
    if (lineHeight < 8) {
      lineHeight = 8; // Minimum line height
    }
  }

  const numLines = options.numLines || 5;
  const height = options.height || ((numLines + 2) * lineHeight);

  // Estimate the editor viewport width to cap only genuinely oversized diagrams.
  // Monospace character width ≈ 0.6× font size. We use 200 columns as a generous
  // full-width estimate so normal diagrams (flowcharts, gantt, sequence) render at
  // their natural size, and only truly huge charts (> ~1680px at 14px font) are
  // constrained. Using fewer columns caused normal charts to be squished (#50).
  const maxWidth = Math.round(fontSize * 0.6 * 200);

  return getMermaidDecoration(source, darkMode, height, options.fontFamily, maxWidth);
}

// Re-export utilities for use by other modules
export { svgToDataUri } from './svg-processor';
export { createErrorSvg } from './error-handler';
export { ensureSvgDimensions, svgToDataUriBase64 } from './svg-processor';

/**
 * Dispose and clean up the Mermaid renderer
 */
export function disposeMermaidRenderer(): void {
  if (webviewManager) {
    webviewManager.dispose();
    webviewManager = undefined;
  }
  
  // Clear decoration cache
  decorationCache.clear();
}
