import * as vscode from "vscode";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { Node, Link, LinkReference, Definition } from "mdast";

/**
 * Represents a node with valid position information
 */
interface PositionedNode {
  position: {
    start: { offset: number };
    end: { offset: number };
  };
}

/**
 * DocumentLinkProvider for markdown files
 * Enables Ctrl+click navigation on links
 */
export class MarkdownLinkProvider implements vscode.DocumentLinkProvider {
  private readonly processor = unified().use(remarkParse).use(remarkGfm);

  provideDocumentLinks(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    const links: vscode.DocumentLink[] = [];

    // Parse the document
    const text = document.getText();
    const ast = this.processor.parse(text);

    // Collect all link definitions (for resolving reference links)
    const definitions = new Map<string, Definition>();
    visit(ast, (node: Node) => {
      if (node.type === "definition" && this.hasValidPosition(node)) {
        const def = node as Definition;
        if (def.identifier) {
          definitions.set(def.identifier.toLowerCase(), def);
        }
      }
    });

    // Process all link nodes
    visit(ast, (node: Node) => {
      if (token.isCancellationRequested) {
        return;
      }

      if (node.type === "link" && this.hasValidPosition(node)) {
        const linkNode = node as Link;
        const url = linkNode.url;

        // Check if this is an auto-link (<url>)
        const startOffset = node.position.start.offset!;
        const endOffset = node.position.end.offset!;
        const beforeChar = startOffset > 0 ? text[startOffset - 1] : "";
        const afterChar = endOffset < text.length ? text[endOffset] : "";
        const nodeStartChar =
          startOffset < text.length ? text[startOffset] : "";
        const nodeEndChar = endOffset > 0 ? text[endOffset - 1] : "";

        let linkStart = startOffset;
        let linkEnd = endOffset;

        // Handle auto-links: <url>
        if (beforeChar === "<" && afterChar === ">") {
          // Brackets are outside the node position
          linkStart = startOffset;
          linkEnd = endOffset;
        } else if (nodeStartChar === "<" && nodeEndChar === ">") {
          // Brackets are inside the node position
          linkStart = startOffset + 1;
          linkEnd = endOffset - 1;
        } else {
          // Regular inline link: [text](url)
          // Make the visible text part (between brackets) clickable, not the URL
          const linkText = text.substring(startOffset, endOffset);
          if (linkText[0] === "[") {
            // Find the closing bracket
            const bracketEnd = linkText.indexOf("]", 1);
            if (bracketEnd !== -1) {
              // Text is between brackets (excluding the brackets themselves)
              linkStart = startOffset + 1;
              linkEnd = startOffset + bracketEnd;
            }
          }
        }

        if (url && this.isValidUrl(url)) {
          try {
            const startPos = document.positionAt(linkStart);
            const endPos = document.positionAt(linkEnd);
            const range = new vscode.Range(startPos, endPos);
            const target = this.resolveUrl(url, document);
            const link = new vscode.DocumentLink(range, target);
            links.push(link);
          } catch (error) {
            // Invalid position, skip
          }
        }
      } else if (node.type === "linkReference" && this.hasValidPosition(node)) {
        // Reference-style link: [text][ref]
        const linkRefNode = node as LinkReference;
        const identifier = linkRefNode.identifier?.toLowerCase();
        if (identifier && definitions.has(identifier)) {
          const definition = definitions.get(identifier)!;
          const url = definition.url;

          if (url && this.isValidUrl(url)) {
            try {
              // Create link for the text part of the reference link
              const startOffset = node.position.start.offset!;
              const endOffset = node.position.end.offset!;

              // Find the text part (first bracket pair)
              const linkText = text.substring(startOffset, endOffset);
              const bracketStart = linkText.indexOf("[");
              const bracketEnd = linkText.indexOf("]", bracketStart + 1);

              if (bracketStart !== -1 && bracketEnd !== -1) {
                const textStart = startOffset + bracketStart + 1;
                const textEnd = startOffset + bracketEnd;
                const startPos = document.positionAt(textStart);
                const endPos = document.positionAt(textEnd);
                const range = new vscode.Range(startPos, endPos);
                const target = this.resolveUrl(url, document);
                const link = new vscode.DocumentLink(range, target);
                links.push(link);
              }
            } catch (error) {
              // Invalid position, skip
            }
          }
        }
      }
    });

    return links;
  }

  /**
   * Check if node has valid position information
   */
  private hasValidPosition(node: Node): node is Node & PositionedNode {
    return (
      !!node.position &&
      node.position.start.offset !== undefined &&
      node.position.start.offset !== null &&
      node.position.end.offset !== undefined &&
      node.position.end.offset !== null
    );
  }

  /**
   * Check if a URL is valid and should be clickable
   */
  private isValidUrl(url: string): boolean {
    if (!url || url.trim().length === 0) {
      return false;
    }
    // Allow http://, https://, mailto:, and relative paths
    return (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("mailto:") ||
      url.startsWith("#") ||
      url.startsWith("/") ||
      !url.includes("://") // Relative path
    );
  }

  /**
   * Resolve a URL to a URI
   * Handles both absolute URLs and relative file paths
   */
  private resolveUrl(
    url: string,
    document: vscode.TextDocument
  ): vscode.Uri | undefined {
    try {
      // Absolute URL
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return vscode.Uri.parse(url);
      }

      // Mailto link
      if (url.startsWith("mailto:")) {
        return vscode.Uri.parse(url);
      }

      // Anchor link (same document)
      if (url.startsWith("#")) {
        return document.uri.with({ fragment: url.substring(1) });
      }

      // Relative file path
      // Resolve relative to the current document's directory
      // Get the parent directory by removing the last path segment
      const currentPath = document.uri.path;
      const lastSlash = currentPath.lastIndexOf("/");
      const parentPath =
        lastSlash > 0 ? currentPath.substring(0, lastSlash) : "/";
      const parentUri = document.uri.with({ path: parentPath });
      const baseUri = vscode.Uri.joinPath(parentUri, url);
      return baseUri;
    } catch (error) {
      return undefined;
    }
  }
}
