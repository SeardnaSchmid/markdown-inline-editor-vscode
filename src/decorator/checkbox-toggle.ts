import { Position, Range, Selection, WorkspaceEdit, type TextEditor, workspace, type TextDocument } from 'vscode';

/**
 * Checks if a line in a document is inside a fenced code block (``` or ~~~).
 */
export function isInsideCodeBlock(document: TextDocument, lineNumber: number): boolean {
  let inside = false;
  let fenceChar = '';
  let fenceLen = 0;
  for (let i = 0; i <= lineNumber; i++) {
    const lineText = document.lineAt(i).text.trimStart();
    if (!inside) {
      const match = lineText.match(/^(`{3,}|~{3,})/);
      if (match) {
        inside = true;
        fenceChar = match[1][0];
        fenceLen = match[1].length;
      }
    } else {
      const match = lineText.match(/^(`{3,}|~{3,})/);
      if (match && match[1][0] === fenceChar && match[1].length >= fenceLen) {
        if (i === lineNumber) {
          return true;
        }
        inside = false;
      }
    }
  }
  return inside;
}

/**
 * Checks if an offset on a line is inside an inline code span (`...`).
 */
export function isInsideInlineCode(lineText: string, charIndex: number): boolean {
  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === '`') {
      let backtickLen = 1;
      while (i + backtickLen < lineText.length && lineText[i + backtickLen] === '`') {
        backtickLen++;
      }
      const closingRun = '`'.repeat(backtickLen);
      const closeIdx = lineText.indexOf(closingRun, i + backtickLen);
      if (closeIdx !== -1) {
        if (charIndex >= i && charIndex < closeIdx + backtickLen) {
          return true;
        }
        i = closeIdx + backtickLen - 1;
      } else {
        i += backtickLen - 1;
      }
    }
  }
  return false;
}

/**
 * Handles checkbox toggle when user clicks inside [ ] or [x].
 * Detects if cursor is positioned on a rendered checkbox and toggles it.
 *
 * @returns true if a checkbox was toggled, false otherwise
 */
export function handleCheckboxClick(editor: TextEditor): boolean {
  const selection = editor.selection;

  // Only handle single cursor clicks (no selection range)
  if (!selection.isEmpty) return false;

  const document = editor.document;
  const line = document.lineAt(selection.active.line);
  const cursorChar = selection.active.character;

  // Do not toggle inside fenced code blocks
  if (isInsideCodeBlock(document, selection.active.line)) {
    return false;
  }

  // Find checkbox pattern on this line: [ ] or [x] or [X]
  const checkboxRegex = /\[([ xX])\]/g;
  let match: RegExpExecArray | null;

  while ((match = checkboxRegex.exec(line.text)) !== null) {
    const bracketStart = match.index;
    const bracketEnd = match.index + 3; // [ ] is 3 chars

    // Do not toggle inside inline code spans
    if (isInsideInlineCode(line.text, bracketStart)) {
      continue;
    }

    // Determine the active click range for this checkbox:
    // If preceded by a list marker (e.g. "- [ ]", "* [ ]", "1. [ ]"), the checkbox decoration
    // visually replaces the marker as well, so clicking on the rendered box places the cursor
    // at the list marker start.
    const textBefore = line.text.substring(0, bracketStart);
    const listMarkerMatch = textBefore.match(/^(\s*([-*+]|\d+[.)])\s+)$/);
    const clickStart = listMarkerMatch ? textBefore.search(/\S/) : bracketStart;

    // Check if cursor is on or inside the checkbox range (including list marker for task items)
    if (cursorChar >= clickStart && cursorChar <= bracketEnd) {
      const currentState = match[1];
      const newState = currentState === ' ' ? 'x' : ' ';

      // Toggle the checkbox
      const edit = new WorkspaceEdit();
      const charPosition = new Position(selection.active.line, bracketStart + 1);
      edit.replace(
        document.uri,
        new Range(charPosition, charPosition.translate(0, 1)),
        newState
      );

      workspace.applyEdit(edit);

      // Move cursor after the checkbox to avoid re-triggering
      const newCursorPos = new Position(selection.active.line, bracketEnd + 1);
      editor.selection = new Selection(newCursorPos, newCursorPos);

      return true;
    }
  }

  return false;
}
