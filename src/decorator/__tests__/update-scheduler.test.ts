import { DecoratorUpdateScheduler } from '../update-scheduler';

describe('DecoratorUpdateScheduler', () => {
  it('runs the latest scheduled callback after debounce', async () => {
    jest.useFakeTimers();

    const scheduler = new DecoratorUpdateScheduler(10, 5);
    const callbackA = jest.fn();
    const callbackB = jest.fn();
    const document = {
      uri: { toString: () => 'file:///test.md' },
      version: 1,
    };

    scheduler.schedule(document as any, callbackA);
    scheduler.schedule(document as any, callbackB);

    jest.runAllTimers();
    await Promise.resolve();

    expect(callbackA).not.toHaveBeenCalled();
    expect(callbackB).toHaveBeenCalledTimes(1);
    scheduler.dispose();
    jest.useRealTimers();
  });

  it('skips outdated callbacks when document version changes', async () => {
    jest.useFakeTimers();

    const scheduler = new DecoratorUpdateScheduler(10, 5);
    const callback = jest.fn();
    const document = {
      uri: { toString: () => 'file:///test.md' },
      version: 1,
    };

    scheduler.schedule(document as any, callback);
    document.version = 2;

    jest.runAllTimers();
    await Promise.resolve();

    expect(callback).not.toHaveBeenCalled();
    scheduler.dispose();
    jest.useRealTimers();
  });

  it('cancels pending work', async () => {
    jest.useFakeTimers();

    const scheduler = new DecoratorUpdateScheduler(10, 5);
    const callback = jest.fn();
    const document = {
      uri: { toString: () => 'file:///test.md' },
      version: 1,
    };

    scheduler.schedule(document as any, callback);
    scheduler.cancel();

    jest.runAllTimers();
    await Promise.resolve();

    expect(callback).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
