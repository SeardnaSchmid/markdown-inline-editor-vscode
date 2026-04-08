import * as vscode from 'vscode';
import { checkRecommendedExtensions } from '../../recommendations';

describe('recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.extensions.getExtension as any) = jest.fn(() => undefined);
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Install');
  });

  it('prompts for missing recommended extensions once', async () => {
    const context = {
      globalState: {
        get: jest.fn(() => false),
        update: jest.fn(() => Promise.resolve()),
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
        get: jest.fn(() => true),
        update: jest.fn(() => Promise.resolve()),
      },
    };

    checkRecommendedExtensions(context as any);

    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('skips installed extensions', () => {
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue({ id: 'installed' });
    const context = {
      globalState: {
        get: jest.fn(() => false),
        update: jest.fn(() => Promise.resolve()),
      },
    };

    checkRecommendedExtensions(context as any);

    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
