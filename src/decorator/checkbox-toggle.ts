import { Position, Range, Selection, WorkspaceEdit, type TextEditor, workspace } from 'vscode';

/** Task-list prefix: indent, bullet or ordered marker, spacing, then a checkbox. */
const TASK_PREFIX_REGEX = /^(\s*)([-*+]|\d+[.)])(\s+)(?=\[[ xX]\])/;

/**
 * Locates the rendered checkbox box on a task-list line.
 *
 * The parser emits the checkbox decoration from the list marker for bullet
 * lists and from the bracket for ordered lists (parser/list-quote.ts), and that
 * whole span is hidden behind the drawn box. A click on the box therefore lands
 * on the decoration start, so the hit area has to start there too — otherwise
 * clicking a bullet task item does nothing.
 *
 * @returns the decoration start and its bracket offset, or null when the line
 *   is not a task item
 */
function findTaskCheckbox(lineText: string): { decorationStart: number; bracketStart: number } | null {
  const match = TASK_PREFIX_REGEX.exec(lineText);
  if (!match) return null;

  const [prefix, indent, marker] = match;
  const isOrderedList = /\d/.test(marker);
  return {
    decorationStart: isOrderedList ? prefix.length : indent.length,
    bracketStart: prefix.length,
  };
}

/**
 * Handles checkbox toggle when user clicks inside [ ] or [x].
 * Detects if cursor is positioned inside a checkbox and toggles it.
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
  const taskCheckbox = findTaskCheckbox(line.text);

  // Find checkbox pattern on this line: [ ] or [x] or [X]
  const checkboxRegex = /\[([ xX])\]/g;
  let match: RegExpExecArray | null;

  while ((match = checkboxRegex.exec(line.text)) !== null) {
    const bracketStart = match.index;
    const bracketEnd = match.index + 3; // [ ] is 3 chars

    // The task-list box swallows the marker before it, so widen the hit area to
    // the decoration start for that first checkbox only.
    const hitStart = taskCheckbox?.bracketStart === bracketStart
      ? taskCheckbox.decorationStart
      : bracketStart;

    // Check if cursor is on or inside the checkbox [ ] range
    if (cursorChar >= hitStart && cursorChar <= bracketEnd) {
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
