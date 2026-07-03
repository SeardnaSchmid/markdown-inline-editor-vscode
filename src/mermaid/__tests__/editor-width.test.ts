import * as vscode from 'vscode';
import { bucketWidthForCache, estimateEditorContentWidthPx } from '../editor-width';

vi.mock('../../config', () => ({
  config: {
    mermaid: {
      maxWidthColumns: vi.fn(() => 0),
    },
  },
}));

import { config } from '../../config';

function createEditor(visibleRanges: vscode.Range[], lines: string[] = ['x'.repeat(120)]): vscode.TextEditor {
  const document = {
    lineAt: (line: number) => ({ text: lines[line] ?? '' }),
  };
  return {
    visibleRanges,
    document,
  } as unknown as vscode.TextEditor;
}

describe('estimateEditorContentWidthPx', () => {
  beforeEach(() => {
    vi.mocked(config.mermaid.maxWidthColumns).mockReturnValue(0);
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: (key: string, defaultValue?: number) => {
        if (key === 'fontSize') return 14;
        if (key === 'lineHeight') return 0;
        return defaultValue;
      },
    } as vscode.WorkspaceConfiguration);
  });

  it('estimates width from visible viewport columns', () => {
    const editor = createEditor([new vscode.Range(0, 0, 0, 150)]);
    const width = estimateEditorContentWidthPx(editor);
    expect(width).toBeGreaterThanOrEqual(320);
    expect(width).toBeLessThanOrEqual(Math.round(14 * 0.6 * 500));
  });

  it('uses configured maxWidthColumns override when set', () => {
    vi.mocked(config.mermaid.maxWidthColumns).mockReturnValue(100);
    const editor = createEditor([new vscode.Range(0, 0, 0, 150)]);
    expect(estimateEditorContentWidthPx(editor)).toBe(Math.round(14 * 0.6 * 100));
  });

  it('enforces a minimum width floor', () => {
    const editor = createEditor([new vscode.Range(0, 0, 0, 10)]);
    expect(estimateEditorContentWidthPx(editor)).toBeGreaterThanOrEqual(320);
  });
});

describe('bucketWidthForCache', () => {
  it('rounds width to 50px buckets', () => {
    expect(bucketWidthForCache(124)).toBe(100);
    expect(bucketWidthForCache(126)).toBe(150);
  });
});
