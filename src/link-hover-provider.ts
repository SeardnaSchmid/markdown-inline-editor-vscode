import * as vscode from "vscode";
import { mapNormalizedToOriginal } from "./position-mapping";
import { shouldSkipInDiffView } from "./diff-context";
import { config } from "./config";
import { MarkdownParseCache } from "./markdown-parse-cache";
import { getForgeContext } from "./forge-context";
import { resolveIssueRefTarget, resolveMentionTarget } from "./link-targets";

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
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const rootUri =
      workspaceFolder?.uri ?? vscode.Uri.joinPath(document.uri, "..");
    const ctx = getForgeContext(rootUri);

    for (const decoration of decorations) {
      if (token.isCancellationRequested) {
        return;
      }

      const start = mapNormalizedToOriginal(decoration.startPos, text);
      const end = mapNormalizedToOriginal(decoration.endPos, text);

      if (hoverOffset < start || hoverOffset >= end) {
        continue;
      }

      let targetUrl: string | undefined;

      if (decoration.type === "link" && decoration.url) {
        targetUrl = decoration.url;
      } else if (
        ctx.enabled &&
        decoration.type === "mention" &&
        decoration.slug
      ) {
        targetUrl = resolveMentionTarget(
          decoration.slug,
          ctx.webBaseUrl,
        )?.toString();
      } else if (
        ctx.enabled &&
        decoration.type === "issueReference" &&
        typeof decoration.issueNumber === "number"
      ) {
        const owner = decoration.ownerRepo?.split("/")[0] ?? ctx.owner;
        const repo = decoration.ownerRepo?.split("/")[1] ?? ctx.repo;
        if (owner && repo) {
          targetUrl = resolveIssueRefTarget(
            owner,
            repo,
            decoration.issueNumber,
            ctx.webBaseUrl,
            ctx.issuePathSegment,
          )?.toString();
        }
      }

      if (!targetUrl) {
        continue;
      }

      const markdown = new vscode.MarkdownString();
      markdown.appendText(`Link URL: ${targetUrl}`);
      if (!singleClickEnabled) {
        markdown.appendMarkdown(
          "\n\n*Direct click disabled (enable in settings).*",
        );
      }
      const hoverRange = new vscode.Range(
        document.positionAt(start),
        document.positionAt(end),
      );
      return new vscode.Hover(markdown, hoverRange);
    }

    return;
  }
}
