import type { Memento } from 'vscode';

const DECORATION_STATE_KEY_PREFIX = 'mdInline.decorationsEnabled';

export class FileDecorationStateStore {
  private readonly fileDecorationState = new Map<string, boolean>();

  constructor(private readonly workspaceState?: Memento) {}

  isEnabled(uri: string): boolean {
    let cached = this.fileDecorationState.get(uri);
    if (cached === undefined) {
      cached = this.workspaceState?.get<boolean>(`${DECORATION_STATE_KEY_PREFIX}.${uri}`, true) ?? true;
      this.fileDecorationState.set(uri, cached);
    }
    return cached;
  }

  toggle(uri: string): boolean {
    const next = !this.isEnabled(uri);
    this.fileDecorationState.set(uri, next);
    void this.workspaceState?.update(`${DECORATION_STATE_KEY_PREFIX}.${uri}`, next);
    return next;
  }

  renameFile(oldUri: string, newUri: string): void {
    const oldKey = `${DECORATION_STATE_KEY_PREFIX}.${oldUri}`;
    const newKey = `${DECORATION_STATE_KEY_PREFIX}.${newUri}`;
    const cachedValue = this.fileDecorationState.get(oldUri);

    if (cachedValue !== undefined) {
      this.fileDecorationState.set(newUri, cachedValue);
      this.fileDecorationState.delete(oldUri);
    }

    const persistedValue = cachedValue ?? this.workspaceState?.get<boolean | undefined>(oldKey, undefined);
    if (persistedValue !== undefined) {
      void this.workspaceState?.update(newKey, persistedValue);
      void this.workspaceState?.update(oldKey, undefined);
    }
  }
}
