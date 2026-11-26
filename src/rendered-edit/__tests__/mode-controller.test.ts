import * as vscode from 'vscode';
import { RenderedEditModeController } from '../mode-controller';

describe('RenderedEditModeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMemento(initial: Record<string, unknown> = {}) {
    const store = new Map<string, unknown>(Object.entries(initial));
    return {
      get: vi.fn((key: string, defaultValue?: unknown) =>
        store.has(key) ? store.get(key) : defaultValue
      ),
      update: vi.fn((key: string, value: unknown) => {
        if (value === undefined) {
          store.delete(key);
        } else {
          store.set(key, value);
        }
        return Promise.resolve();
      }),
      keys: () => Array.from(store.keys()),
    };
  }

  it('sets mode globally across all files', () => {
    const memento = createMemento();
    const controller = new RenderedEditModeController(memento as any);

    expect(controller.getMode('file:///a.md')).toBe('hybrid');

    expect(controller.setMode('file:///a.md', 'visual')).toBe('visual');
    expect(controller.getMode('file:///b.md')).toBe('visual');

    expect(controller.setMode('file:///b.md', 'hybrid')).toBe('hybrid');
    expect(controller.getMode('file:///a.md')).toBe('hybrid');

    expect(controller.setMode('file:///a.md', 'raw')).toBe('raw');
    expect(controller.getMode('file:///b.md')).toBe('raw');
  });

  it('preserves last rendered mode when switching to raw and syncs context keys', () => {
    const memento = createMemento();
    const controller = new RenderedEditModeController(memento as any);

    controller.setMode('file:///a.md', 'visual');
    controller.syncUI('file:///a.md', true);

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'mdInline.mode', 'visual');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'mdInline.lastRenderedMode', 'visual');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'mdInline.renderedEditMode', true);

    vi.clearAllMocks();
    controller.setMode('file:///a.md', 'raw');
    controller.syncUI('file:///a.md', false);

    expect(controller.getLastRenderedMode('file:///a.md')).toBe('visual');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'mdInline.mode', 'raw');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'mdInline.lastRenderedMode', 'visual');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'mdInline.renderedEditMode', false);

    const restored = new RenderedEditModeController(memento as any);
    expect(restored.getMode('file:///a.md')).toBe('raw');
    expect(restored.getLastRenderedMode('file:///a.md')).toBe('visual');
  });
});
