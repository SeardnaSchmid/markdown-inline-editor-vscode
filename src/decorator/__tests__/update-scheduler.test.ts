import { DecoratorUpdateScheduler } from '../update-scheduler';

describe('DecoratorUpdateScheduler', () => {
  it('runs the latest scheduled callback after debounce', async () => {
    vi.useFakeTimers();

    const scheduler = new DecoratorUpdateScheduler(10, 5);
    const callbackA = vi.fn();
    const callbackB = vi.fn();
    const document = {
      uri: { toString: () => 'file:///test.md' },
      version: 1,
    };

    scheduler.schedule(document as any, callbackA);
    scheduler.schedule(document as any, callbackB);

    vi.runAllTimers();
    await Promise.resolve();

    expect(callbackA).not.toHaveBeenCalled();
    expect(callbackB).toHaveBeenCalledTimes(1);
    scheduler.dispose();
    vi.useRealTimers();
  });

  it('skips outdated callbacks when document version changes', async () => {
    vi.useFakeTimers();

    const scheduler = new DecoratorUpdateScheduler(10, 5);
    const callback = vi.fn();
    const document = {
      uri: { toString: () => 'file:///test.md' },
      version: 1,
    };

    scheduler.schedule(document as any, callback);
    document.version = 2;

    vi.runAllTimers();
    await Promise.resolve();

    expect(callback).not.toHaveBeenCalled();
    scheduler.dispose();
    vi.useRealTimers();
  });

  it('cancels pending work', async () => {
    vi.useFakeTimers();

    const scheduler = new DecoratorUpdateScheduler(10, 5);
    const callback = vi.fn();
    const document = {
      uri: { toString: () => 'file:///test.md' },
      version: 1,
    };

    scheduler.schedule(document as any, callback);
    scheduler.cancel();

    vi.runAllTimers();
    await Promise.resolve();

    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
