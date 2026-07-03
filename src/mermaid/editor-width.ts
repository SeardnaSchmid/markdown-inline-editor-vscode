import * as vscode from 'vscode';
import { config } from '../config';

const CHAR_WIDTH_RATIO = 0.6;
const DEFAULT_COLUMNS = 120;
const MIN_MAX_WIDTH_PX = 320;
const MAX_MAX_WIDTH_PX = 4096;
const WIDTH_BUCKET_PX = 50;

/**
 * Estimates the editor content area width in pixels for scaling Mermaid diagrams.
 * Uses visible viewport columns when no explicit setting override is configured.
 */
export function estimateEditorContentWidthPx(editor: vscode.TextEditor): number {
  const editorConfig = vscode.workspace.getConfiguration('editor');
  const fontSize = editorConfig.get<number>('fontSize', 14);
  const configuredColumns = config.mermaid.maxWidthColumns();
  const columns = configuredColumns > 0 ? configuredColumns : estimateVisibleColumns(editor);
  const width = Math.round(fontSize * CHAR_WIDTH_RATIO * columns);
  return Math.min(MAX_MAX_WIDTH_PX, Math.max(MIN_MAX_WIDTH_PX, width));
}

/** Buckets width for render cache keys so minor viewport changes do not churn the cache. */
export function bucketWidthForCache(widthPx: number): number {
  return Math.round(widthPx / WIDTH_BUCKET_PX) * WIDTH_BUCKET_PX;
}

function estimateVisibleColumns(editor: vscode.TextEditor): number {
  const visibleRanges = editor.visibleRanges ?? [];
  if (visibleRanges.length === 0) {
    return DEFAULT_COLUMNS;
  }

  let maxViewportColumns = 0;
  for (const range of editor.visibleRanges) {
    const lineColumns = range.end.character - range.start.character;
    if (lineColumns > maxViewportColumns) {
      maxViewportColumns = lineColumns;
    }
  }

  if (maxViewportColumns >= 40) {
    return maxViewportColumns;
  }

  let maxLineEnd = 0;
  for (const range of editor.visibleRanges) {
    for (let line = range.start.line; line <= range.end.line; line++) {
      maxLineEnd = Math.max(maxLineEnd, editor.document.lineAt(line).text.length);
    }
  }

  return Math.max(maxViewportColumns, maxLineEnd, DEFAULT_COLUMNS);
}
