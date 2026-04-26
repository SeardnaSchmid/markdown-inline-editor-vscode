import type { TextDocument } from 'vscode';

const DEFAULT_IDLE_TIMEOUT_MS = 300;

export class DecoratorUpdateScheduler {
  private updateTimeout: NodeJS.Timeout | undefined;
  private idleCallbackHandle: number | undefined;
  private readonly pendingUpdateVersion = new Map<string, number>();

  constructor(
    private readonly debounceTimeoutMs: number,
    private readonly idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS
  ) {}

  schedule(document: TextDocument, callback: () => void): void {
    const cacheKey = document.uri.toString();
    this.pendingUpdateVersion.set(cacheKey, document.version);

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }

    if (this.idleCallbackHandle !== undefined) {
      this.cancelIdleCallback(this.idleCallbackHandle);
      this.idleCallbackHandle = undefined;
    }

    this.updateTimeout = setTimeout(() => {
      this.updateTimeout = undefined;
      const scheduledVersion = this.pendingUpdateVersion.get(cacheKey);
      if (scheduledVersion !== document.version) {
        return;
      }

      this.idleCallbackHandle = this.requestIdleCallback(() => {
        this.idleCallbackHandle = undefined;
        callback();
        this.pendingUpdateVersion.delete(cacheKey);
      }, { timeout: this.idleTimeoutMs });
    }, this.debounceTimeoutMs);
  }

  cancel(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }

    if (this.idleCallbackHandle !== undefined) {
      this.cancelIdleCallback(this.idleCallbackHandle);
      this.idleCallbackHandle = undefined;
    }
  }

  dispose(): void {
    this.cancel();
    this.pendingUpdateVersion.clear();
  }

  private requestIdleCallback(callback: () => void, options?: { timeout?: number }): number {
    return setTimeout(callback, options?.timeout || 50) as unknown as number;
  }

  private cancelIdleCallback(handle: number): void {
    clearTimeout(handle);
  }
}
