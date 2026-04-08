import { FileDecorationStateStore } from '../file-decoration-state';

function makeMockWorkspaceState() {
  const stateMap = new Map<string, unknown>();
  return {
    get: vi.fn(<T>(key: string, defaultValue: T): T =>
      stateMap.has(key) ? (stateMap.get(key) as T) : defaultValue
    ),
    update: vi.fn((key: string, value: unknown) => {
      if (value === undefined) {
        stateMap.delete(key);
      } else {
        stateMap.set(key, value);
      }
      return Promise.resolve();
    }),
  };
}

describe('FileDecorationStateStore', () => {
  it('defaults to enabled for unseen files', () => {
    const store = new FileDecorationStateStore();
    expect(store.isEnabled('file:///test/file-a.md')).toBe(true);
  });

  it('reads persisted state on first access', () => {
    const workspaceState = makeMockWorkspaceState();
    void workspaceState.update('mdInline.decorationsEnabled.file:///test/file-a.md', false);
    workspaceState.update.mockClear();

    const store = new FileDecorationStateStore(workspaceState as any);
    expect(store.isEnabled('file:///test/file-a.md')).toBe(false);
    expect(workspaceState.get).toHaveBeenCalledWith(
      'mdInline.decorationsEnabled.file:///test/file-a.md',
      true
    );
  });

  it('toggles and persists state per uri', () => {
    const workspaceState = makeMockWorkspaceState();
    const store = new FileDecorationStateStore(workspaceState as any);

    expect(store.toggle('file:///test/file-a.md')).toBe(false);
    expect(store.isEnabled('file:///test/file-a.md')).toBe(false);
    expect(workspaceState.update).toHaveBeenCalledWith(
      'mdInline.decorationsEnabled.file:///test/file-a.md',
      false
    );
  });

  it('keeps states isolated by file', () => {
    const store = new FileDecorationStateStore();
    store.toggle('file:///test/file-a.md');

    expect(store.isEnabled('file:///test/file-a.md')).toBe(false);
    expect(store.isEnabled('file:///test/file-b.md')).toBe(true);
  });

  it('migrates in-memory and persisted state on rename', () => {
    const workspaceState = makeMockWorkspaceState();
    const store = new FileDecorationStateStore(workspaceState as any);

    store.toggle('file:///test/old.md');
    workspaceState.update.mockClear();

    store.renameFile('file:///test/old.md', 'file:///test/new.md');

    expect(store.isEnabled('file:///test/old.md')).toBe(true);
    expect(store.isEnabled('file:///test/new.md')).toBe(false);
    expect(workspaceState.update).toHaveBeenCalledWith(
      'mdInline.decorationsEnabled.file:///test/new.md',
      false
    );
    expect(workspaceState.update).toHaveBeenCalledWith(
      'mdInline.decorationsEnabled.file:///test/old.md',
      undefined
    );
  });
});
