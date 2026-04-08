import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { disposeLogger, logDebug, logError, logPerformanceMetric, logWarn } from '../../logging';

describe('logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    disposeLogger();
  });

  it('does not create an output channel for debug logs when debug logging is disabled', () => {
    logDebug('skipped');

    expect(vscode.window.createOutputChannel).not.toHaveBeenCalled();
  });

  it('writes warnings and errors to the output channel', () => {
    logWarn('warning message', new Error('boom'));
    logError('error message', 'bad');

    expect(vscode.window.createOutputChannel).toHaveBeenCalledTimes(1);
    const channel = (vscode.window.createOutputChannel as Mock).mock.results[0].value;
    expect(channel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[warn] warning message'));
    expect(channel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[error] error message'));
  });

  it('writes performance metrics only when performance logging is enabled', () => {
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: <T>(key: string, defaultValue: T): T => {
        if (key === 'debug.performance.enabled') {
          return true as T;
        }
        return defaultValue;
      },
    } as any);

    logPerformanceMetric('decorator.update', { totalMs: 12, decorations: 5 });

    const channel = (vscode.window.createOutputChannel as Mock).mock.results[0].value;
    expect(channel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('[perf] decorator.update totalMs=12 decorations=5')
    );
  });

  it('disposes the output channel when requested', () => {
    logWarn('warning message');
    const channel = (vscode.window.createOutputChannel as Mock).mock.results[0].value;

    disposeLogger();

    expect(channel.dispose).toHaveBeenCalledTimes(1);
  });
});
