import * as vscode from 'vscode';
import { mapNormalizedToOriginal } from './position-mapping';
import { shouldSkipInDiffView } from './diff-context';
import { MarkdownParseCache } from './markdown-parse-cache';
import { renderMermaidSvgNatural, createErrorSvg, svgToDataUri } from './mermaid/mermaid-renderer';
import { svgToDataUriBase64 } from './mermaid/svg-processor';
import * as cheerio from 'cheerio';
import { logWarn } from './logging';

/**
 * Configuration for code block hover previews
 */
interface CodeBlockHoverConfig {
  /** Maximum width for hover preview in pixels */
  maxWidth: number;
  /** Maximum height for hover preview in pixels */
  maxHeight: number;
  /** Scale factor for hover preview (e.g., 2.0 = 2x larger than inline) */
  scaleFactor: number;
}

/**
 * Default configuration for code block hover previews
 */
const DEFAULT_HOVER_CONFIG: CodeBlockHoverConfig = {
  maxWidth: 1200,
  maxHeight: 900,
  scaleFactor: 2.5,
};

/**
 * Result of a code block hover handler
 */
interface CodeBlockHoverResult {
  dataUri?: string;
  html?: string;
  width: number;
  height: number;
}

/**
 * Handler function type for rendering code block content for hover preview
 * @param source - The source code from the code block
 * @param language - The language identifier (e.g., 'mermaid', 'latex')
 * @param config - Hover configuration
 * @param cancellationToken - Optional cancellation token for hover requests
 * @returns Promise resolving to hover result with data URI and dimensions, or undefined if not supported
 */
type CodeBlockHoverHandler = (
  source: string,
  language: string,
  config: CodeBlockHoverConfig,
  cancellationToken?: vscode.CancellationToken
) => Promise<CodeBlockHoverResult | undefined>;

/**
 * Ensure SVG has explicit width and height attributes for proper display
 * Some Mermaid diagrams (especially state diagrams) may have percentage-based
 * or missing dimensions that need to be set explicitly
 */
function ensureSvgDimensions(svgString: string, width: number, height: number): string {
  const $ = cheerio.load(svgString, { xmlMode: true });
  const svgNode = $('svg').first();
  
  if (svgNode.length === 0) {
    return svgString;
  }
  
  // Set explicit pixel-based dimensions
  svgNode.attr('width', `${width}px`);
  svgNode.attr('height', `${height}px`);
  
  // Ensure viewBox exists if it doesn't, using the calculated dimensions
  if (!svgNode.attr('viewBox')) {
    svgNode.attr('viewBox', `0 0 ${width} ${height}`);
  }
  
  // Remove any percentage-based width that might interfere
  const currentWidth = svgNode.attr('width');
  if (currentWidth && currentWidth.includes('%')) {
    svgNode.attr('width', `${width}px`);
  }
  
  return svgNode.toString();
}

/**
 * Generic hover provider for code blocks with special rendering (Mermaid, LaTeX, etc.)
 * 
 * Shows a larger preview when hovering over code blocks that support special rendering.
 */
export class CodeBlockHoverProvider implements vscode.HoverProvider {
  private handlers = new Map<string, CodeBlockHoverHandler>();

  constructor(
    private parseCache: MarkdownParseCache,
    private hoverConfig: CodeBlockHoverConfig = DEFAULT_HOVER_CONFIG
  ) {
    // Register Mermaid handler
    this.registerHandler('mermaid', this.handleMermaidHover.bind(this));
  }

  /**
   * Register a hover handler for a specific language
   * @param language - Language identifier (e.g., 'mermaid', 'latex')
   * @param handler - Handler function that renders the preview
   */
  registerHandler(language: string, handler: CodeBlockHoverHandler): void {
    this.handlers.set(language.toLowerCase(), handler);
  }

  /**
   * Handle Mermaid diagram hover - renders a larger version of the diagram
   * Sizes the hover based on the actual diagram dimensions
   */
  private async handleMermaidHover(
    source: string,
    language: string,
    config: CodeBlockHoverConfig,
    cancellationToken?: vscode.CancellationToken
  ): Promise<CodeBlockHoverResult | undefined> {
    try {
      const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast
        ? 'dark'
        : 'default';

      const fontFamily = vscode.workspace.getConfiguration('editor').get<string>('fontFamily');
      
      // Render at natural size first to get actual diagram dimensions
      // Pass cancellation token for shorter timeout (5 seconds) to match VS Code hover timeout
      const naturalSvg = await renderMermaidSvgNatural(source, {
        theme,
        fontFamily,
      }, cancellationToken);

      // Parse natural SVG to get actual dimensions
      const $ = cheerio.load(naturalSvg, { xmlMode: true });
      const svgNode = $('svg').first();
      
      if (svgNode.length === 0) {
        return undefined;
      }

      // Get SVG dimensions from natural render
      // Try to get width/height from attributes, or viewBox
      const widthAttr = svgNode.attr('width') || '0';
      const heightAttr = svgNode.attr('height') || '0';
      
      // Handle percentage-based dimensions (Mermaid often uses width="100%")
      let svgWidth = widthAttr === '100%' ? 0 : parseFloat(widthAttr) || 0;
      let svgHeight = parseFloat(heightAttr) || 0;
      
      // If no explicit width/height, try viewBox (most reliable source)
      if ((svgWidth === 0 || svgHeight === 0) && svgNode.attr('viewBox')) {
        const viewBox = svgNode.attr('viewBox')!.split(/\s+/);
        if (viewBox.length >= 4) {
          const viewBoxWidth = parseFloat(viewBox[2]) || 0;
          const viewBoxHeight = parseFloat(viewBox[3]) || 0;
          if (svgWidth === 0 && viewBoxWidth > 0) {
            svgWidth = viewBoxWidth;
          }
          if (svgHeight === 0 && viewBoxHeight > 0) {
            svgHeight = viewBoxHeight;
          }
        }
      }

      // If still no dimensions, try to get from SVG content bounds
      // This is a fallback for diagrams that don't set explicit dimensions
      if (svgWidth === 0 || svgHeight === 0) {
        // Try to find the actual content bounds by looking for the main group
        const mainGroup = svgNode.find('g').first();
        if (mainGroup.length > 0) {
          // For state diagrams and other diagrams, the main group might have bounds
          // If viewBox exists, use it as the most reliable source
          const viewBox = svgNode.attr('viewBox');
          if (viewBox) {
            const viewBoxParts = viewBox.split(/\s+/);
            if (viewBoxParts.length >= 4) {
              const viewBoxWidth = parseFloat(viewBoxParts[2]) || 0;
              const viewBoxHeight = parseFloat(viewBoxParts[3]) || 0;
              if (svgWidth === 0 && viewBoxWidth > 0) {
                svgWidth = viewBoxWidth;
              }
              if (svgHeight === 0 && viewBoxHeight > 0) {
                svgHeight = viewBoxHeight;
              }
            }
          }
        }
      }

      // Final fallback: use reasonable defaults based on diagram type
      if (svgWidth === 0 || svgHeight === 0) {
        // For state diagrams, they're often more compact, so use smaller defaults
        const isStateDiagram = source.trim().toLowerCase().startsWith('statediagram');
        if (isStateDiagram) {
          svgWidth = svgWidth === 0 ? 600 : svgWidth;
          svgHeight = svgHeight === 0 ? 400 : svgHeight;
        } else {
          svgWidth = svgWidth === 0 ? 800 : svgWidth;
          svgHeight = svgHeight === 0 ? 600 : svgHeight;
        }
      }

      // Use natural dimensions for hover - adapt dialog size to content
      // For large diagrams, show them large; for small diagrams, show them appropriately sized
      let hoverWidth = svgWidth;
      let hoverHeight = svgHeight;

      // Apply a minimum scale to ensure readability for small diagrams
      const minScale = 1.5;
      if (hoverWidth < 400 || hoverHeight < 300) {
        hoverWidth = Math.max(hoverWidth * minScale, 400);
        hoverHeight = Math.max(hoverHeight * minScale, 300);
        // Maintain aspect ratio
        const aspectRatio = svgHeight / svgWidth;
        if (hoverWidth * aspectRatio > hoverHeight) {
          hoverHeight = hoverWidth * aspectRatio;
        } else {
          hoverWidth = hoverHeight / aspectRatio;
        }
      }

      // Cap hover dimensions even more aggressively to reduce SVG size
      // Smaller dimensions = smaller SVG = smaller data URI = less likely to truncate
      // Further reduced from 1200px to 1000px for better size reduction
      const maxWidth = Math.min(config.maxWidth, 1000); // Cap at 1000px (reduced from 1200px)
      const maxHeight = Math.min(config.maxHeight, 750); // Cap at 750px (reduced from 900px)
      
      if (hoverWidth > maxWidth) {
        const aspectRatio = hoverHeight / hoverWidth;
        hoverWidth = maxWidth;
        hoverHeight = hoverWidth * aspectRatio;
      }
      if (hoverHeight > maxHeight) {
        const aspectRatio = hoverWidth / hoverHeight;
        hoverHeight = maxHeight;
        hoverWidth = hoverHeight * aspectRatio;
      }

      // Ensure SVG has explicit dimensions for proper display in hover
      // Some diagrams (like state diagrams) may have percentage-based or missing dimensions
      const processedSvg = ensureSvgDimensions(naturalSvg, hoverWidth, hoverHeight);
      
      return {
        html: processedSvg,
        width: Math.round(hoverWidth),
        height: Math.round(hoverHeight),
      };
    } catch (error) {
      logWarn('[Code Block Hover] Mermaid render failed', error);
      // Create error SVG to display in hover instead of returning undefined
      // Extract meaningful error message
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message || error.toString() || 'Rendering failed';
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = String(error) || 'Rendering failed';
      }
      // Ensure we have a non-empty error message
      if (!errorMessage || errorMessage.trim().length === 0) {
        errorMessage = 'Unknown rendering error occurred';
      }
      const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;
      const errorSvg = createErrorSvg(
        errorMessage,
        config.maxWidth,
        Math.min(config.maxHeight, 300),
        isDark
      );
      return {
        html: ensureSvgDimensions(errorSvg, config.maxWidth, Math.min(config.maxHeight, 300)),
        width: config.maxWidth,
        height: Math.min(config.maxHeight, 300),
      };
    }
  }

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

    const hoverOffset = document.offsetAt(position);

    // Check Mermaid blocks from parser
    // Only trigger hover when hovering over the indicator decorator (⧉)
    for (const block of parseEntry.mermaidBlocks) {
      if (token.isCancellationRequested) {
        return;
      }

      const start = mapNormalizedToOriginal(block.startPos, text);
      const end = mapNormalizedToOriginal(block.endPos, text);

      // Find the content start (after opening fence line) where the indicator is placed
      // This matches the logic in decorator.ts
      const originalText = document.getText();
      const openingFenceLineEnd = originalText.indexOf('\n', start);
      const contentStart = openingFenceLineEnd !== -1 ? openingFenceLineEnd + 1 : start;
      const indicatorEnd = contentStart + 1; // Indicator is 1 character wide

      // Only check if hover position is within the indicator area (not the entire block)
      if (hoverOffset >= contentStart && hoverOffset < indicatorEnd) {
        return this.createHoverForCodeBlock(
          block.source,
          'mermaid',
          document,
          start,
          end,
          token
        );
      }
    }

    // Check other code blocks by parsing the AST
    // We need to find code blocks with language identifiers
    // This is a fallback for languages not yet in mermaidBlocks
    return this.findCodeBlockInDecorations(
      parseEntry.decorations,
      text,
      hoverOffset,
      document,
      token
    );
  }

  /**
   * Find code block from decorations (for languages not in mermaidBlocks)
   * Checks if hover is anywhere within a code block (language identifier or content)
   */
  private findCodeBlockInDecorations(
    decorations: Array<{ startPos: number; endPos: number; type: string }>,
    text: string,
    hoverOffset: number,
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    // First, find all code blocks with language identifiers
    const languageDecs = decorations.filter(d => d.type === 'codeBlockLanguage');
    const codeBlockDecs = decorations.filter(d => d.type === 'codeBlock');
    
    // Check each code block to see if hover is within it
    for (const codeBlockDec of codeBlockDecs) {
      if (token.isCancellationRequested) {
        return;
      }

      const codeStart = mapNormalizedToOriginal(codeBlockDec.startPos, text);
      const codeEnd = mapNormalizedToOriginal(codeBlockDec.endPos, text);

      // Check if hover is within this code block
      if (hoverOffset >= codeStart && hoverOffset < codeEnd) {
        // Find the language identifier for this code block
        const langDec = languageDecs.find(l => 
          l.startPos >= codeBlockDec.startPos &&
          l.endPos <= codeBlockDec.endPos
        );

        if (langDec) {
          // Extract language from text
          const language = text.substring(langDec.startPos, langDec.endPos).trim().toLowerCase();
          
          // Check if we have a handler for this language
          if (this.handlers.has(language)) {
            // Extract source code from the code block
            const codeBlockText = document.getText(new vscode.Range(
              document.positionAt(codeStart),
              document.positionAt(codeEnd)
            ));

            // Extract source by removing fence lines
            const lines = codeBlockText.split('\n');
            if (lines.length >= 3) {
              // Remove first line (opening fence with language) and last line (closing fence)
              const source = lines.slice(1, -1).join('\n');
              
              return this.createHoverForCodeBlock(
                source,
                language,
                document,
                codeStart,
                codeEnd,
                token
              );
            }
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Create a hover for a code block with special rendering
   */
  private async createHoverForCodeBlock(
    source: string,
    language: string,
    document: vscode.TextDocument,
    start: number,
    end: number,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const handler = this.handlers.get(language.toLowerCase());
    if (!handler) {
      return undefined;
    }

    try {
      const result = await handler(source, language, this.hoverConfig, token);
      if (!result || token.isCancellationRequested) {
        return undefined;
      }

      // Create hover with explicit large size (override any SVG max-width constraints)
      // Note: supportHtml and isTrusted must be set before adding HTML content
      const markdown = new vscode.MarkdownString();
      markdown.supportHtml = true;
      markdown.isTrusted = true; // SVGs are safe
      
      if (result.html) {
        // Try multiple encoding strategies to avoid VS Code hover size limits
        // Strategy: URL encoding (smaller) -> Base64 (different handling) -> fallback message
        const svgSize = result.html.length;
        const MAX_DATA_URI_SIZE = 80 * 1024; // 80KB threshold
        
        let imageSrc: string | undefined;
        
        // First try URL-encoded data URI (typically smaller for SVG)
        const urlEncodedUri = svgToDataUri(result.html);
        const urlEncodedSize = urlEncodedUri.length;
        
        if (urlEncodedSize <= MAX_DATA_URI_SIZE) {
          // URL encoding fits - use it
          imageSrc = urlEncodedUri;
        } else {
          // URL encoding too large - try Base64 (might be handled differently by VS Code)
          const base64Uri = svgToDataUriBase64(result.html);
          const base64Size = base64Uri.length;
          
          if (base64Size <= MAX_DATA_URI_SIZE) {
            // Base64 fits - use it
            imageSrc = base64Uri;
          } else {
            // Both encodings too large - show helpful, informative message
            const sizeKB = Math.round(svgSize / 1024);
            const dataUriKB = Math.round(Math.max(urlEncodedSize, base64Size) / 1024);
            
            markdown.appendMarkdown(
              `## 📊 Mermaid Diagram Preview\n\n` +
              `**Size:** ${sizeKB}KB (data URI: ${dataUriKB}KB)  \n` +
              `**Dimensions:** ${result.width}px × ${result.height}px\n\n` +
              `---\n\n` +
              `⚠️ **Cannot display in hover**\n\n` +
              `This diagram exceeds VS Code's hover content size limits (~80KB). This is a limitation of VS Code's hover rendering system, not the diagram itself.\n\n` +
              `✅ **The diagram renders correctly inline in the editor** - you can see it above in the document.\n\n` +
              `💡 **Tip:** For very large diagrams, consider breaking them into smaller, more focused diagrams for better readability.`
            );
            // Don't add preview label for error message
            imageSrc = undefined;
          }
        }
        
        if (imageSrc) {
          const escapedUri = escapeHtmlAttribute(imageSrc);
          markdown.appendMarkdown(
            `<img src="${escapedUri}" width="${result.width}" height="${result.height}" style="width: ${result.width}px; height: ${result.height}px; max-width: ${result.width}px; max-height: ${result.height}px;" />`
          );
          markdown.appendMarkdown(`\n\n*${language} diagram preview*`);
        }
      } else if (result.dataUri) {
        // Only escape quotes in data URI (data URI is already encoded, don't escape &, <, >)
        const escapedUri = escapeHtmlAttribute(result.dataUri);
        markdown.appendMarkdown(
          `<img src="${escapedUri}" width="${result.width}" height="${result.height}" style="width: ${result.width}px; height: ${result.height}px; max-width: ${result.width}px; max-height: ${result.height}px;" />`
        );
        markdown.appendMarkdown(`\n\n*${language} diagram preview*`);
      } else {
        return undefined;
      }

      // Expand hover range to full line(s) for better UX
      // This makes it easier to trigger hover and includes the indicator area
      const startPos = document.positionAt(start);
      const endPos = document.positionAt(end);
      const hoverRange = new vscode.Range(
        new vscode.Position(startPos.line, 0),
        new vscode.Position(endPos.line, Number.MAX_SAFE_INTEGER)
      );

      return new vscode.Hover(markdown, hoverRange);
    } catch (error) {
      logWarn(`[Code Block Hover] Failed to create hover for ${language}`, error);
      return undefined;
    }
  }
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/"/g, '&quot;');
}
