import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import useAppStore, {
  APP_PREFERENCES_STORAGE_KEY,
  createAppStore,
} from '../src/store/useAppStore';
import usePlayerStore, {
  PLAYER_PREFERENCES_STORAGE_KEY,
  createPlayerStore,
} from '../src/store/usePlayerStore';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class ThrowingGetStorage extends MemoryStorage {
  getItem(_key: string): string | null {
    throw new Error('storage disabled');
  }
}

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let storage: MemoryStorage;

function installStorage(value: Storage) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value,
  });
}

function resetStoreState() {
  useAppStore.setState({
    activeTab: 'dashboard',
    theme: 'dark',
    serverUrl: 'http://localhost:9997',
    isSidebarCollapsed: false,
  });
  usePlayerStore.setState({
    drawerStream: null,
    isDrawerOpen: false,
    streamsView: 'table',
    gridLayout: '2x2',
    activeGridStreams: new Map(),
  });
  storage.clear();
}

function setPersisted(key: string, state: unknown) {
  storage.setItem(key, JSON.stringify({ state }));
}

function readPersisted(key: string) {
  const value = storage.getItem(key);
  expect(value).not.toBeNull();
  return JSON.parse(value as string) as {
    state: Record<string, unknown>;
    version?: number;
  };
}

beforeEach(() => {
  storage = new MemoryStorage();
  installStorage(storage);
  resetStoreState();
});

afterEach(() => {
  resetStoreState();
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

describe('application preferences', () => {
  test('cold production store initialization uses all first-run defaults', () => {
    const coldAppStore = createAppStore(storage);
    const coldPlayerStore = createPlayerStore(storage);

    expect(coldAppStore.getState()).toMatchObject({
      theme: 'dark',
      serverUrl: 'http://localhost:9997',
    });
    expect(coldPlayerStore.getState()).toMatchObject({
      streamsView: 'table',
      gridLayout: '2x2',
    });
    expect(coldPlayerStore.getState().activeGridStreams).toEqual(new Map());
  });

  test('cold production store initialization synchronously hydrates valid saved values', () => {
    setPersisted(APP_PREFERENCES_STORAGE_KEY, {
      theme: 'light',
      serverUrl: 'http://cold-start.mediamtx.test:9997',
    });
    setPersisted(PLAYER_PREFERENCES_STORAGE_KEY, {
      streamsView: 'grid',
      gridLayout: '4x4',
      activeGridStreams: [
        [0, 'cold/nested'],
        [15, 'å†·ãŸã„/ã‚«ãƒ¡ãƒ©'],
      ],
    });

    const coldAppStore = createAppStore(storage);
    const coldPlayerStore = createPlayerStore(storage);

    expect(coldAppStore.persist.hasHydrated()).toBe(true);
    expect(coldPlayerStore.persist.hasHydrated()).toBe(true);
    expect(coldAppStore.getState()).toMatchObject({
      theme: 'light',
      serverUrl: 'http://cold-start.mediamtx.test:9997',
    });
    expect(coldPlayerStore.getState()).toMatchObject({
      streamsView: 'grid',
      gridLayout: '4x4',
    });
    expect(coldPlayerStore.getState().activeGridStreams).toEqual(
      new Map([
        [0, 'cold/nested'],
        [15, 'å†·ãŸã„/ã‚«ãƒ¡ãƒ©'],
      ])
    );
  });

  test('synchronously restores valid light/dark themes and server URLs', () => {
    for (const theme of ['light', 'dark'] as const) {
      const serverUrl = `http://${theme}.mediamtx.test:9997`;
      setPersisted(APP_PREFERENCES_STORAGE_KEY, { theme, serverUrl });

      useAppStore.persist.rehydrate();

      expect(useAppStore.getState()).toMatchObject({ theme, serverUrl });
    }
  });

  test('persists only theme and server URL without expiry metadata', () => {
    useAppStore.setState({
      activeTab: 'streams',
      isSidebarCollapsed: true,
    });
    useAppStore.getState().setTheme('light');
    useAppStore.getState().setServerUrl('http://saved.mediamtx.test:9997');

    const persisted = readPersisted(APP_PREFERENCES_STORAGE_KEY);
    expect(persisted.state).toEqual({
      theme: 'light',
      serverUrl: 'http://saved.mediamtx.test:9997',
    });
    expect(JSON.stringify(persisted)).not.toMatch(/expir|timestamp|expiresAt|savedAt/i);
  });

  test('restores valid fields independently and falls back for invalid values', () => {
    setPersisted(APP_PREFERENCES_STORAGE_KEY, {
      theme: 'unknown',
      serverUrl: 'http://valid.mediamtx.test',
    });

    useAppStore.persist.rehydrate();

    expect(useAppStore.getState()).toMatchObject({
      theme: 'dark',
      serverUrl: 'http://valid.mediamtx.test',
    });
  });
});

describe('Streams player preferences', () => {
  test('round-trips every view and grid layout independently', () => {
    const views = ['table', 'cards', 'grid'] as const;
    const layouts = ['1x1', '2x2', '3x3', '4x4'] as const;

    for (const view of views) {
      usePlayerStore.getState().setStreamsView(view);
      for (const layout of layouts) {
        usePlayerStore.getState().setGridLayout(layout);
        const persisted = readPersisted(PLAYER_PREFERENCES_STORAGE_KEY);
        expect(persisted.state).toMatchObject({
          streamsView: view,
          gridLayout: layout,
        });
      }
    }

    usePlayerStore.getState().setStreamsView('cards');
    usePlayerStore.getState().setGridLayout('4x4');
    usePlayerStore.getState().setStreamsView('table');
    expect(usePlayerStore.getState().gridLayout).toBe('4x4');

    const saved = storage.getItem(PLAYER_PREFERENCES_STORAGE_KEY);
    usePlayerStore.setState({ streamsView: 'cards', gridLayout: '1x1' });
    storage.setItem(PLAYER_PREFERENCES_STORAGE_KEY, saved as string);
    usePlayerStore.persist.rehydrate();
    expect(usePlayerStore.getState()).toMatchObject({
      streamsView: 'table',
      gridLayout: '4x4',
    });
  });

  test('persists additions, replacements, clears, exact slots, and Unicode names as a Map', () => {
    const store = usePlayerStore.getState();
    store.setGridStream(0, 'building/floor/camera');
    store.setGridStream(7, '入口/カメラ-🎥');
    store.setGridStream(0, 'building/replacement');
    store.setGridStream(12, 'temporary');
    store.clearGridStream(12);

    const persisted = readPersisted(PLAYER_PREFERENCES_STORAGE_KEY);
    expect(persisted.state.activeGridStreams).toEqual([
      [0, 'building/replacement'],
      [7, '入口/カメラ-🎥'],
    ]);

    const saved = storage.getItem(PLAYER_PREFERENCES_STORAGE_KEY);
    usePlayerStore.setState({ activeGridStreams: new Map() });
    storage.setItem(PLAYER_PREFERENCES_STORAGE_KEY, saved as string);
    usePlayerStore.persist.rehydrate();
    expect(usePlayerStore.getState().activeGridStreams).toBeInstanceOf(Map);
    expect(usePlayerStore.getState().activeGridStreams).toEqual(
      new Map([
        [0, 'building/replacement'],
        [7, '入口/カメラ-🎥'],
      ])
    );
  });

  test('ignores invalid enums and slot records while retaining valid assignments', () => {
    setPersisted(PLAYER_PREFERENCES_STORAGE_KEY, {
      streamsView: 'tiles',
      gridLayout: '5x5',
      activeGridStreams: [
        [2, 'valid/nested'],
        ['3', 'nonnumeric'],
        [-1, 'negative'],
        [1.5, 'fractional'],
        [4, 123],
        [5, ''],
        [6, '   '],
        ['malformed'],
      ],
    });

    usePlayerStore.persist.rehydrate();

    expect(usePlayerStore.getState()).toMatchObject({
      streamsView: 'table',
      gridLayout: '2x2',
    });
    expect(usePlayerStore.getState().activeGridStreams).toEqual(new Map([[2, 'valid/nested']]));
  });

  test('persists no transient drawer state', () => {
    usePlayerStore.setState({
      drawerStream: { name: 'drawer-only' },
      isDrawerOpen: true,
    });
    usePlayerStore.getState().setStreamsView('grid');

    const persisted = readPersisted(PLAYER_PREFERENCES_STORAGE_KEY);
    expect(Object.keys(persisted.state).sort()).toEqual([
      'activeGridStreams',
      'gridLayout',
      'streamsView',
    ]);
  });
});

describe('storage failure boundaries and UI integration', () => {
  test('cold initialization falls back to concrete valid defaults for malformed JSON', () => {
    storage.setItem(APP_PREFERENCES_STORAGE_KEY, '{not-json');
    storage.setItem(PLAYER_PREFERENCES_STORAGE_KEY, '{"state":');

    const coldAppStore = createAppStore(storage);
    const coldPlayerStore = createPlayerStore(storage);

    expect(coldAppStore.getState()).toMatchObject({
      theme: 'dark',
      serverUrl: 'http://localhost:9997',
    });
    expect(coldPlayerStore.getState()).toMatchObject({
      streamsView: 'table',
      gridLayout: '2x2',
    });
    expect(coldPlayerStore.getState().activeGridStreams).toEqual(new Map());
  });

  test('cold initialization falls back when localStorage.getItem throws', () => {
    installStorage(new ThrowingGetStorage());

    const coldAppStore = createAppStore();
    const coldPlayerStore = createPlayerStore();

    expect(coldAppStore.getState()).toMatchObject({
      theme: 'dark',
      serverUrl: 'http://localhost:9997',
    });
    expect(coldPlayerStore.getState()).toMatchObject({
      streamsView: 'table',
      gridLayout: '2x2',
    });
    expect(coldPlayerStore.getState().activeGridStreams).toEqual(new Map());
  });

  test('unavailable storage does not crash preference actions', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage disabled');
      },
    });

    expect(() => useAppStore.getState().setTheme('light')).not.toThrow();
    expect(() => useAppStore.getState().setServerUrl('http://memory-only.test')).not.toThrow();
    expect(() => usePlayerStore.getState().setStreamsView('cards')).not.toThrow();
    expect(() => usePlayerStore.getState().setGridLayout('3x3')).not.toThrow();
    expect(() => usePlayerStore.getState().setGridStream(1, 'memory/stream')).not.toThrow();
    expect(() => usePlayerStore.getState().clearGridStream(1)).not.toThrow();
  });

  test('StreamsPage uses persisted view state and does not reset grid size across views', () => {
    const source = readFileSync(
      new URL('../src/pages/StreamsPage.tsx', import.meta.url),
      'utf8'
    );

    expect(source).toContain('const layout = usePlayerStore((s) => s.streamsView)');
    expect(source).toContain('const setLayout = usePlayerStore((s) => s.setStreamsView)');
    expect(source).not.toContain("useState<LayoutMode>('table')");
    expect(source).not.toContain("setGridLayout('single')");
    expect(source.match(/onAddToGrid=\{handleAddToGrid\}/g)).toHaveLength(2);
  });
});
