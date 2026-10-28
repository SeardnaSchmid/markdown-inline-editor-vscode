import { Position, Range, WorkspaceEdit, type TextEditor, workspace } from 'vscode';
import type { ParseEntry } from '../markdown-parse-cache';
import { createRange } from './editor-decoration-applier';

export type CheckboxTarget = {
  /** Full parser-defined unit that the rendered checkbox can hit. */
  hitRange: Range;
  /** Source `[ ]` or `[x]` range whose middle character stores the state. */
  syntaxRange: Range;
  checked: boolean;
};

/**
 * Builds checkbox click targets from the same cached parser result used to
 * render them. This keeps click eligibility identical to render eligibility:
 * code, malformed task markers, blockquotes, and nested lists need no second
 * Markdown implementation here.
 */
export function buildCheckboxTargets(editor: TextEditor, entry: ParseEntry): CheckboxTarget[] {
  const checkboxScopes = entry.scopes.filter((scope) => scope.kind === 'checkbox');
  const targets: CheckboxTarget[] = [];

  for (const decoration of entry.decorations) {
    if (decoration.type !== 'checkboxUnchecked' && decoration.type !== 'checkboxChecked') {
      continue;
    }

    const scope = checkboxScopes.find(
      (candidate) =>
        candidate.startPos <= decoration.startPos && candidate.endPos >= decoration.endPos
    );
    if (!scope) continue;

    const hitRange = createRange(editor, scope.startPos, scope.endPos, entry.text);
    const syntaxRange = createRange(
      editor,
      decoration.startPos,
      decoration.endPos,
      entry.text
    );
    if (!hitRange || !syntaxRange) continue;

    targets.push({
      hitRange,
      syntaxRange,
      checked: decoration.type === 'checkboxChecked',
    });
  }

  return targets;
}

/**
 * Toggles a rendered checkbox when the mouse selection lands in a
 * parser-defined checkbox target.
 *
 * The decorator restores the selection that was active before the click.
 *
 * @returns true if a checkbox edit was requested, false otherwise
 */
export function handleCheckboxClick(
  editor: TextEditor,
  targets: readonly CheckboxTarget[]
): boolean {
  const selection = editor.selection;
  if (!selection.isEmpty) return false;

  const target = targets.find(({ hitRange }) => hitRange.contains(selection.active));
  if (!target) return false;

  const statePosition = new Position(
    target.syntaxRange.start.line,
    target.syntaxRange.start.character + 1
  );
  const edit = new WorkspaceEdit();
  edit.replace(
    editor.document.uri,
    new Range(statePosition, statePosition.translate(0, 1)),
    target.checked ? ' ' : 'x'
  );

  void workspace.applyEdit(edit);
  return true;
}
