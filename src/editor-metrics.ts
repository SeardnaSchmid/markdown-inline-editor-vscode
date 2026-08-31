import { workspace } from 'vscode';

/**
 * Editor line height in pixels, derived from the `editor.fontSize` and
 * `editor.lineHeight` settings.
 *
 * VS Code exposes no API for the rendered line height, so this mirrors its
 * fallback rules (as Markless does): `lineHeight` of 0 or below 8 means "auto"
 * and scales off the font size, values below 10 are treated as a multiplier,
 * and anything larger is an explicit pixel height.
 *
 * @returns Line height in pixels, never below 8
 */
export function getEditorLineHeight(): number {
  const editorConfig = workspace.getConfiguration('editor');
  const fontSize = editorConfig.get<number>('fontSize', 14);
  const lineHeightSetting = editorConfig.get<number>('lineHeight', 0);

  if (lineHeightSetting >= 10) {
    return Math.round(lineHeightSetting);
  }
  if (lineHeightSetting >= 8) {
    return Math.round(fontSize * lineHeightSetting);
  }

  const multiplier = process.platform === 'darwin' ? 1.5 : 1.35;
  return Math.max(8, Math.round(fontSize * multiplier));
}
