import * as vscode from "vscode";
import { MarkdownParseCache } from "./markdown-parse-cache";
import { mapNormalizedToOriginal } from "./position-mapping";
import { shouldSkipInDiffView } from "./diff-context";
import {
  resolveImageTarget,
  resolveLinkTarget,
  toCommandUri,
  resolveMentionTarget,
  resolveIssueRefTarget,
} from "./link-targets";
import { getForgeContext } from "./forge-context";

/**
 * Provides clickable links and images for markdown documents.
 *
 * This class implements VS Code's DocumentLinkProvider to make markdown links
 * and images clickable. It parses markdown links/images and creates DocumentLink
 * objects that VS Code can render as clickable.
 *
 * - Links: Click to navigate to URL or anchor
 * - Images: Click to open image file in VS Code's image viewer
 *
 * Note: Links inside code blocks are already filtered out by the parser's
 * post-processing filter (filterDecorationsInCodeBlocks), so this provider
 * only receives valid link decorations.
 *
 * However, VS Code's built-in markdown link provider may still detect links using
 * regex patterns and doesn't respect code blocks. If you see links inside code blocks,
 * they are likely from VS Code's built-in provider, not this extension.
 */
export class MarkdownLinkProvider implements vscode.DocumentLinkProvider {
  constructor(private parseCache: MarkdownParseCache) {}

  /**
   * Provides document links for a markdown document.
   *
   * @param document - The text document
   * @param token - Cancellation token
   * @returns Array of DocumentLink objects
   */
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    if (document.languageId !== "markdown") {
      return [];
    }

    // Skip links in diff views when decorations are disabled (raw markdown mode)
    if (shouldSkipInDiffView(document)) {
      return [];
    }

    const parseEntry = this.parseCache.get(document);
    const text = parseEntry.text;
    const decorations = parseEntry.decorations;
    const links: vscode.DocumentLink[] = [];

    // Find all link decorations with URLs
    // Note: Links inside code blocks are already filtered out by the parser's
    // post-processing filter (filterDecorationsInCodeBlocks), so we don't need
    // to check scopes here.
    for (const decoration of decorations) {
      if (
        (decoration.type === "link" || decoration.type === "image") &&
        decoration.url
      ) {
        const url = decoration.url;

        // Map normalized positions to original document positions (handles CRLF -> LF normalization)
        const mappedStart = mapNormalizedToOriginal(decoration.startPos, text);
        const mappedEnd = mapNormalizedToOriginal(decoration.endPos, text);

        // Create range for the link/image text (not the URL)
        const startPos = document.positionAt(mappedStart);
        const endPos = document.positionAt(mappedEnd);
        const range = new vscode.Range(startPos, endPos);

        // Create document link
        let target: vscode.Uri | undefined;

        if (decoration.type === "image") {
          target = resolveImageTarget(url, document.uri);
        } else {
          const resolved = resolveLinkTarget(url, document.uri);
          if (resolved?.kind === "command") {
            target = toCommandUri(resolved.command, resolved.args);
          } else {
            target = resolved?.uri;
          }
        }

        if (target) {
          const link = new vscode.DocumentLink(range, target);
          links.push(link);
        }
      }
    }

    // Mention and issue-reference links when in remote context (URL computed from decoration metadata).
    // Fall back to document directory when there is no workspace folder so git detection still works.
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const rootUri =
      workspaceFolder?.uri ?? vscode.Uri.joinPath(document.uri, "..");
    const ctx = getForgeContext(rootUri);
    if (ctx.enabled) {
      for (const decoration of decorations) {
        if (decoration.type === "mention" && decoration.slug) {
          const target = resolveMentionTarget(decoration.slug, ctx.webBaseUrl);
          if (target) {
            const mappedStart = mapNormalizedToOriginal(decoration.startPos, text);
            const mappedEnd = mapNormalizedToOriginal(decoration.endPos, text);
            const range = new vscode.Range(
              document.positionAt(mappedStart),
              document.positionAt(mappedEnd),
            );
            links.push(new vscode.DocumentLink(range, target));
          }
        } else if (
          decoration.type === "issueReference" &&
          typeof decoration.issueNumber === "number"
        ) {
          const owner = decoration.ownerRepo?.split("/")[0] ?? ctx.owner;
          const repo = decoration.ownerRepo?.split("/")[1] ?? ctx.repo;
          if (owner && repo) {
            const target = resolveIssueRefTarget(
              owner,
              repo,
              decoration.issueNumber,
              ctx.webBaseUrl,
              ctx.issuePathSegment,
            );
            if (target) {
              const mappedStart = mapNormalizedToOriginal(decoration.startPos, text);
              const mappedEnd = mapNormalizedToOriginal(decoration.endPos, text);
              const range = new vscode.Range(
                document.positionAt(mappedStart),
                document.positionAt(mappedEnd),
              );
              links.push(new vscode.DocumentLink(range, target));
            }
          }
        }
      }
    }

    return links;
  }

  /**
   * Resolves a document link, potentially updating its target.
   *
   * @param link - The document link to resolve
   * @param token - Cancellation token
   * @returns The resolved link
   */
  resolveDocumentLink(
    link: vscode.DocumentLink,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentLink> {
    return link;
  }
}
