import * as vscode from 'vscode';
import { LinkClickHandler } from '../../link-click-handler';
import { registerProviders } from '../register-providers';

describe('registerProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers document link and hover providers and returns a link click handler', () => {
    const parseCache = {} as any;
    const result = registerProviders(parseCache);

    expect(vscode.languages.registerDocumentLinkProvider).toHaveBeenCalledTimes(1);
    expect(vscode.languages.registerHoverProvider).toHaveBeenCalledTimes(3);
    expect(result.disposables).toHaveLength(5);
    expect(result.linkClickHandler).toBeDefined();
  });

  it('disposes the link click handler through the returned disposable list', () => {
    const disposeSpy = vi.spyOn(LinkClickHandler.prototype, 'dispose');

    const result = registerProviders({} as any);
    result.disposables[4].dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
