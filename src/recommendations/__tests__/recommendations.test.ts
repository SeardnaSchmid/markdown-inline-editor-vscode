import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { checkRecommendedExtensions } from '../../recommendations';

describe('recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (vscode.extensions.getExtension as any) = vi.fn(() => undefined);
    (vscode.window.showInformationMessage as Mock).mockResolvedValue('Install');
  });

  it('prompts for missing recommended extensions once', async () => {
    const context = {
      globalState: {
        get: vi.fn(() => false),
        update: vi.fn(() => Promise.resolve()),
      },
    };

    checkRecommendedExtensions(context as any);
    await Promise.resolve();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(2);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.extensions.installExtension',
      'yzhang.markdown-all-in-one'
    );
  });

  it('skips already-shown recommendations', () => {
    const context = {
      globalState: {
        get: vi.fn(() => true),
        update: vi.fn(() => Promise.resolve()),
      },
    };

    checkRecommendedExtensions(context as any);

    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('skips installed extensions', () => {
    (vscode.extensions.getExtension as Mock).mockReturnValue({ id: 'installed' });
    const context = {
      globalState: {
        get: vi.fn(() => false),
        update: vi.fn(() => Promise.resolve()),
      },
    };

    checkRecommendedExtensions(context as any);

    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
