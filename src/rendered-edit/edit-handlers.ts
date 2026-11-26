import * as vscode from 'vscode';
import type { Decorator } from '../decorator';
import type { MarkdownParseCache } from '../markdown-parse-cache';
import type { RenderedEditCursorGuard } from './cursor-guard';
import {
  buildRenderedEditMap,
  computeSelectionDeletionRanges,
  computeSingleCharDeletionRanges,
  extractVisibleText,
  findVisibleWordBoundary,
  isRangeInRawFallbackBlock,
  mergeOffsetRanges,
  type OffsetRange,
} from './marker-map';

async function runRenderedDelete(
  decorator: Decorator,
  parseCache: MarkdownParseCache,
  direction: 'backward' | 'forward',
  byWord: boolean,
  fallbackCommand: string
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !decorator.isRenderedEditMode()) {
    await vscode.commands.executeCommand(fallbackCommand);
    return;
  }

  const doc = editor.document;
  const entry = parseCache.get(doc);
  const map = buildRenderedEditMap(doc, entry);

  for (const sel of editor.selections) {
    const startOff = doc.offsetAt(sel.start);
    const endOff = doc.offsetAt(sel.end);
    if (isRangeInRawFallbackBlock(map, startOff, endOff)) {
      await vscode.commands.executeCommand(fallbackCommand);
      return;
    }
  }

  const text = doc.getText();
  const allDeletes: OffsetRange[] = [];

  for (const sel of editor.selections) {
    const startOff = doc.offsetAt(sel.start);
    const endOff = doc.offsetAt(sel.end);

    if (!sel.isEmpty) {
      allDeletes.push(...computeSelectionDeletionRanges(doc, map, startOff, endOff));
      continue;
    }

    if (byWord) {
      const bound = findVisibleWordBoundary(text, map, startOff, direction);
      const from = Math.min(startOff, bound);
      const to = Math.max(startOff, bound);
      if (from < to) {
        allDeletes.push(...computeSelectionDeletionRanges(doc, map, from, to));
      }
    } else {
      allDeletes.push(...computeSingleCharDeletionRanges(doc, map, startOff, direction));
    }
  }

  const merged = mergeOffsetRanges(allDeletes);
  if (merged.length === 0) {
    return;
  }

  await editor.edit((editBuilder) => {
    for (const r of merged) {
      editBuilder.delete(new vscode.Range(doc.positionAt(r.start), doc.positionAt(r.end)));
    }
  });
}

async function runRenderedCopyOrCut(
  decorator: Decorator,
  parseCache: MarkdownParseCache,
  isCut: boolean
): Promise<void> {
  const fallbackCommand = isCut
    ? 'editor.action.clipboardCutAction'
    : 'editor.action.clipboardCopyAction';
  const editor = vscode.window.activeTextEditor;
  if (!editor || !decorator.isRenderedEditMode()) {
    await vscode.commands.executeCommand(fallbackCommand);
    return;
  }

  const doc = editor.document;
  const entry = parseCache.get(doc);
  const map = buildRenderedEditMap(doc, entry);
  const eol = doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';

  const copiedParts: string[] = [];
  const deleteRanges: OffsetRange[] = [];

  for (const sel of editor.selections) {
    if (sel.isEmpty) {
      const line = doc.lineAt(sel.active.line);
      const lineStart = doc.offsetAt(line.range.start);
      const lineEnd = doc.offsetAt(line.range.end);
      copiedParts.push(extractVisibleText(doc, entry, map, lineStart, lineEnd) + eol);
      if (isCut) {
        const lineEndWithBreak = doc.offsetAt(line.rangeIncludingLineBreak.end);
        deleteRanges.push({ start: lineStart, end: lineEndWithBreak });
      }
      continue;
    }

    const startOff = doc.offsetAt(sel.start);
    const endOff = doc.offsetAt(sel.end);
    copiedParts.push(extractVisibleText(doc, entry, map, startOff, endOff));
    if (isCut) {
      deleteRanges.push(...computeSelectionDeletionRanges(doc, map, startOff, endOff));
    }
  }

  await vscode.env.clipboard.writeText(copiedParts.join(eol));

  if (isCut) {
    const merged = mergeOffsetRanges(deleteRanges);
    if (merged.length > 0) {
      await editor.edit((editBuilder) => {
        for (const r of merged) {
          editBuilder.delete(new vscode.Range(doc.positionAt(r.start), doc.positionAt(r.end)));
        }
      });
    }
  }
}

export function registerRenderedEditCommands(
  decorator: Decorator,
  parseCache: MarkdownParseCache,
  cursorGuard: RenderedEditCursorGuard
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('mdInline.renderedEdit.backspace', () =>
      runRenderedDelete(decorator, parseCache, 'backward', false, 'deleteLeft')
    ),
    vscode.commands.registerCommand('mdInline.renderedEdit.deleteRight', () =>
      runRenderedDelete(decorator, parseCache, 'forward', false, 'deleteRight')
    ),
    vscode.commands.registerCommand('mdInline.renderedEdit.deleteWordLeft', () =>
      runRenderedDelete(decorator, parseCache, 'backward', true, 'deleteWordLeft')
    ),
    vscode.commands.registerCommand('mdInline.renderedEdit.deleteWordRight', () =>
      runRenderedDelete(decorator, parseCache, 'forward', true, 'deleteWordRight')
    ),
    vscode.commands.registerCommand('mdInline.renderedEdit.copy', () =>
      runRenderedCopyOrCut(decorator, parseCache, false)
    ),
    vscode.commands.registerCommand('mdInline.renderedEdit.cut', () =>
      runRenderedCopyOrCut(decorator, parseCache, true)
    ),
    vscode.commands.registerCommand('mdInline.renderedEdit.cursorLeft', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !decorator.isRenderedEditMode() || !cursorGuard.moveCursor(editor, parseCache, 'left')) {
        await vscode.commands.executeCommand('cursorLeft');
      }
    }),
    vscode.commands.registerCommand('mdInline.renderedEdit.cursorRight', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !decorator.isRenderedEditMode() || !cursorGuard.moveCursor(editor, parseCache, 'right')) {
        await vscode.commands.executeCommand('cursorRight');
      }
    }),
    vscode.commands.registerCommand('mdInline.renderedEdit.cursorLeftSelect', async () => {
      const editor = vscode.window.activeTextEditor;
      if (
        !editor ||
        !decorator.isRenderedEditMode() ||
        !cursorGuard.moveCursor(editor, parseCache, 'left', { select: true })
      ) {
        await vscode.commands.executeCommand('cursorLeftSelect');
      }
    }),
    vscode.commands.registerCommand('mdInline.renderedEdit.cursorRightSelect', async () => {
      const editor = vscode.window.activeTextEditor;
      if (
        !editor ||
        !decorator.isRenderedEditMode() ||
        !cursorGuard.moveCursor(editor, parseCache, 'right', { select: true })
      ) {
        await vscode.commands.executeCommand('cursorRightSelect');
      }
    }),
    vscode.commands.registerCommand('mdInline.renderedEdit.cursorWordLeft', async () => {
      const editor = vscode.window.activeTextEditor;
      if (
        !editor ||
        !decorator.isRenderedEditMode() ||
        !cursorGuard.moveCursor(editor, parseCache, 'left', { byWord: true })
      ) {
        await vscode.commands.executeCommand('cursorWordLeft');
      }
    }),
    vscode.commands.registerCommand('mdInline.renderedEdit.cursorWordRight', async () => {
      const editor = vscode.window.activeTextEditor;
      if (
        !editor ||
        !decorator.isRenderedEditMode() ||
        !cursorGuard.moveCursor(editor, parseCache, 'right', { byWord: true })
      ) {
        await vscode.commands.executeCommand('cursorWordRight');
      }
    }),
    vscode.commands.registerCommand('mdInline.renderedEdit.cursorWordLeftSelect', async () => {
      const editor = vscode.window.activeTextEditor;
      if (
        !editor ||
        !decorator.isRenderedEditMode() ||
        !cursorGuard.moveCursor(editor, parseCache, 'left', { select: true, byWord: true })
      ) {
        await vscode.commands.executeCommand('cursorWordLeftSelect');
      }
    }),
    vscode.commands.registerCommand('mdInline.renderedEdit.cursorWordRightSelect', async () => {
      const editor = vscode.window.activeTextEditor;
      if (
        !editor ||
        !decorator.isRenderedEditMode() ||
        !cursorGuard.moveCursor(editor, parseCache, 'right', { select: true, byWord: true })
      ) {
        await vscode.commands.executeCommand('cursorWordRightSelect');
      }
    }),
  ];
}
