import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { createToggleDecorationsCommand } from '../toggle-decorations';

describe('mode commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the three switchTo mode commands calling setMode', () => {
    const handlers = new Map<string, () => void>();
    (vscode.commands.registerCommand as Mock).mockImplementation((id, cb) => {
      handlers.set(id, cb);
      return { dispose: vi.fn() };
    });

    const decorator = {
      setMode: vi.fn((mode) => mode),
    };

    createToggleDecorationsCommand(decorator as any);

    expect(Array.from(handlers.keys())).toEqual([
      'mdInline.switchToVisual',
      'mdInline.switchToHybrid',
      'mdInline.switchToRaw',
    ]);

    handlers.get('mdInline.switchToVisual')?.();
    handlers.get('mdInline.switchToHybrid')?.();
    handlers.get('mdInline.switchToRaw')?.();
    expect(decorator.setMode).toHaveBeenNthCalledWith(1, 'visual');
    expect(decorator.setMode).toHaveBeenNthCalledWith(2, 'hybrid');
    expect(decorator.setMode).toHaveBeenNthCalledWith(3, 'raw');
  });
});
