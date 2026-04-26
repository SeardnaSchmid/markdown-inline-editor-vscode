import * as vscode from 'vscode';
import type { DecorationRange } from '../parser';
import { getForgeContext } from '../forge-context';
import {
  resolveImageTarget,
  resolveIssueRefTarget,
  resolveLinkTarget,
  resolveMentionTarget,
  toCommandUri,
} from '../link-targets';
import { mapNormalizedToOriginal } from '../position-mapping';

export type InteractionTarget =
  | { kind: 'uri'; uri: vscode.Uri }
  | { kind: 'command'; command: string; args: unknown[] };

export function getDocumentRootUri(documentUri: vscode.Uri): vscode.Uri {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  return workspaceFolder?.uri ?? vscode.Uri.joinPath(documentUri, '..');
}

export function createDecorationRange(
  document: vscode.TextDocument,
  decoration: DecorationRange,
  normalizedText: string
): vscode.Range {
  const mappedStart = mapNormalizedToOriginal(decoration.startPos, normalizedText);
  const mappedEnd = mapNormalizedToOriginal(decoration.endPos, normalizedText);
  return new vscode.Range(
    document.positionAt(mappedStart),
    document.positionAt(mappedEnd)
  );
}

export function findDecorationAtOffset(
  decorations: readonly DecorationRange[],
  normalizedText: string,
  offset: number,
  document: vscode.TextDocument,
  predicate: (decoration: DecorationRange) => boolean
): DecorationRange | undefined {
  return decorations.find((decoration) => {
    if (!predicate(decoration)) {
      return false;
    }

    const start = mapNormalizedToOriginal(decoration.startPos, normalizedText);
    const end = mapNormalizedToOriginal(decoration.endPos, normalizedText);
    return offset >= start && offset < end;
  });
}

export function resolveInteractionTarget(
  decoration: DecorationRange,
  documentUri: vscode.Uri
): InteractionTarget | undefined {
  if (decoration.type === 'image' && decoration.url) {
    const uri = resolveImageTarget(decoration.url, documentUri);
    return uri ? { kind: 'uri', uri } : undefined;
  }

  if (decoration.type === 'link' && decoration.url) {
    const resolved = resolveLinkTarget(decoration.url, documentUri);
    if (!resolved) {
      return undefined;
    }
    return resolved;
  }

  const ctx = getForgeContext(getDocumentRootUri(documentUri));
  if (!ctx.enabled) {
    return undefined;
  }

  if (decoration.type === 'mention' && decoration.slug) {
    const uri = resolveMentionTarget(decoration.slug, ctx.webBaseUrl);
    return uri ? { kind: 'uri', uri } : undefined;
  }

  if (
    decoration.type === 'issueReference' &&
    typeof decoration.issueNumber === 'number'
  ) {
    const owner = decoration.ownerRepo?.split('/')[0] ?? ctx.owner;
    const repo = decoration.ownerRepo?.split('/')[1] ?? ctx.repo;
    if (!owner || !repo) {
      return undefined;
    }

    const uri = resolveIssueRefTarget(
      owner,
      repo,
      decoration.issueNumber,
      ctx.webBaseUrl,
      ctx.issuePathSegment
    );
    return uri ? { kind: 'uri', uri } : undefined;
  }

  return undefined;
}

export function toInteractionUri(target: InteractionTarget): vscode.Uri {
  return target.kind === 'command'
    ? toCommandUri(target.command, target.args)
    : target.uri;
}

export function getInteractionDisplayValue(
  decoration: DecorationRange,
  target: InteractionTarget
): string {
  if (decoration.type === 'link' || decoration.type === 'image') {
    return decoration.url ?? toInteractionUri(target).toString();
  }

  return toInteractionUri(target).toString();
}

export function isLinkDecoration(decoration: DecorationRange): boolean {
  return (
    (decoration.type === 'link' || decoration.type === 'image') &&
    typeof decoration.url === 'string'
  );
}

export function isLinkLikeDecoration(decoration: DecorationRange): boolean {
  return isLinkDecoration(decoration) ||
    (decoration.type === 'mention' && typeof decoration.slug === 'string') ||
    (decoration.type === 'issueReference' && typeof decoration.issueNumber === 'number');
}
