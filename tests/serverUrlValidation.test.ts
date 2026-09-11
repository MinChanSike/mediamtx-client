import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { SSRProvider } from '@fluentui/react-components';
import AppSidebar from '@src/components/layout/AppSidebar';
import { apiFetch } from '@src/api/client';
import useAppStore, {
  APP_PREFERENCES_STORAGE_KEY,
  createAppStore,
} from '@src/store/useAppStore';
import useMediaMTXApiStore from '@src/store/useMediaMTXApiStore';
import { isAbsoluteHttpUrl } from '@src/utils/serverUrl';

const originalFetch = globalThis.fetch;
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'window',
);
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'document',
);

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

let storage: MemoryStorage;
let renderer: ReactTestRenderer | undefined;

function installStorage(value: Storage) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value,
  });
}

function setPersisted(key: string, state: unknown) {
  storage.setItem(key, JSON.stringify({ state }));
}

function readPersistedServerUrl(key: string): unknown {
  const value = storage.getItem(key);
  if (value === null) return undefined;
  return (JSON.parse(value) as { state: { serverUrl?: unknown } }).state
    .serverUrl;
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installGlobalConfigMock() {
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.endsWith('/v3/config/global/get')) {
      return jsonResponse({
        logLevel: 'info',
        logDestinations: ['stdout'],
        logFile: 'mediamtx.log',
        readTimeout: '10s',
        writeTimeout: '10s',
        readBufferCount: 512,
        udpMaxPayloadSize: 1472,
        apiAddress: '127.0.0.1:9997',
        metricsAddress: '127.0.0.1:9998',
        hlsAddress: ':8888',
        rtspAddress: ':8554',
        rtmpAddress: ':1935',
        webrtcAddress: ':8889',
        paths: {},
      });
    }
    return jsonResponse({ error: 'not found' }, 404);
  }) as typeof fetch;
}

function installFakeDom() {
  const fakeWindow = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    history: {
      state: null,
      go: () => undefined,
      pushState: () => undefined,
      replaceState: () => undefined,
    },
    location: {
      pathname: '/',
      href: 'http://localhost/',
      hash: '',
      search: '',
      origin: 'http://localhost',
    },
  };
  const fakeDocument = {
    defaultView: fakeWindow,
    documentElement: {
      classList: { add: () => undefined, remove: () => undefined },
    },
    querySelector: () => null,
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: fakeDocument,
  });
}

function restoreDom() {
  for (const [name, descriptor] of [
    ['window', originalWindowDescriptor],
    ['document', originalDocumentDescriptor],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  }
}

async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

function resetStores(serverUrl = 'http://localhost:9997') {
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({
    activeTab: 'dashboard',
    theme: 'dark',
    serverUrl,
    isSidebarCollapsed: false,
  });
  useMediaMTXApiStore.getState().resetForServerUrl(serverUrl);
}

function pathsListWith(name: string) {
  return {
    itemCount: 1,
    pageCount: 1,
    items: [
      {
        name,
        source: 'publisher',
        sourceError: '',
        tracks: [],
        bytesReceived: 0,
        bytesSent: 0,
        readers: [],
      },
    ],
  };
}

function findNodeById(
  root: ReactTestInstance,
  id: string,
): ReactTestInstance | null {
  return root.findAll((node) => node.props?.id === id)[0] ?? null;
}

function treeContainsText(root: ReactTestInstance, text: string): boolean {
  return (
    root.findAll((node) =>
      (node.children ?? []).some(
        (child) => typeof child === 'string' && child.includes(text),
      ),
    ).length > 0
  );
}

beforeEach(() => {
  storage = new MemoryStorage();
  installStorage(storage);
  installGlobalConfigMock();
  resetStores();
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
    renderer = undefined;
    await flushMicrotasks();
  });
  globalThis.fetch = originalFetch;
  resetStores();
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(
      globalThis,
      'localStorage',
      originalLocalStorageDescriptor,
    );
  } else {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
  restoreDom();
});

describe('isAbsoluteHttpUrl', () => {
  test('accepts absolute http and https URLs that carry a host', () => {
    expect(isAbsoluteHttpUrl('http://localhost:9997')).toBe(true);
    expect(isAbsoluteHttpUrl('https://example.com')).toBe(true);
    expect(isAbsoluteHttpUrl('http://127.0.0.1:9997')).toBe(true);
    expect(
      isAbsoluteHttpUrl('https://mediamtx.test:9997/v3/config/global/get'),
    ).toBe(true);
    expect(isAbsoluteHttpUrl('http://[::1]:9997')).toBe(true);
    expect(isAbsoluteHttpUrl('http://user:pass@mediamtx.test:9997')).toBe(true);
  });

  test('rejects schemeless host:port values that new URL parses with a bogus scheme', () => {
    expect(isAbsoluteHttpUrl('localhost:9997')).toBe(false);
    expect(isAbsoluteHttpUrl('127.0.0.1:9997')).toBe(false);
    expect(isAbsoluteHttpUrl('mediamtx.test')).toBe(false);
    expect(isAbsoluteHttpUrl(':9997')).toBe(false);
  });

  test('rejects non-http schemes', () => {
    expect(isAbsoluteHttpUrl('ftp://mediamtx.test')).toBe(false);
    expect(isAbsoluteHttpUrl('file:///etc/hosts')).toBe(false);
    expect(isAbsoluteHttpUrl('ws://mediamtx.test:9997')).toBe(false);
    expect(isAbsoluteHttpUrl('wss://mediamtx.test:9997')).toBe(false);
    expect(isAbsoluteHttpUrl('rtsp://camera:554/stream')).toBe(false);
    expect(isAbsoluteHttpUrl('data:text/plain,hello')).toBe(false);
    expect(isAbsoluteHttpUrl('javascript:alert(1)')).toBe(false);
  });

  test('rejects http and https URLs whose host cannot be parsed', () => {
    expect(isAbsoluteHttpUrl('http://')).toBe(false);
    expect(isAbsoluteHttpUrl('https://')).toBe(false);
  });

  test('rejects empty and blank values', () => {
    expect(isAbsoluteHttpUrl('')).toBe(false);
    expect(isAbsoluteHttpUrl('   ')).toBe(false);
  });
});

describe('serverUrl hydration (mergeAppPreferences)', () => {
  test('rejects a schemeless persisted serverUrl and falls back to the default across reloads', () => {
    setPersisted(APP_PREFERENCES_STORAGE_KEY, {
      theme: 'dark',
      serverUrl: 'localhost:9997',
    });
    useAppStore.persist.rehydrate();

    expect(useAppStore.getState().serverUrl).toBe('http://localhost:9997');
  });

  test('restores a valid absolute http serverUrl', () => {
    setPersisted(APP_PREFERENCES_STORAGE_KEY, {
      theme: 'light',
      serverUrl: 'http://restored.mediamtx.test:9997',
    });
    useAppStore.persist.rehydrate();

    expect(useAppStore.getState()).toMatchObject({
      theme: 'light',
      serverUrl: 'http://restored.mediamtx.test:9997',
    });
  });

  test('trims surrounding whitespace from a valid persisted serverUrl', () => {
    setPersisted(APP_PREFERENCES_STORAGE_KEY, {
      theme: 'dark',
      serverUrl: '   http://padded.mediamtx.test:9997   ',
    });
    useAppStore.persist.rehydrate();

    expect(useAppStore.getState().serverUrl).toBe(
      'http://padded.mediamtx.test:9997',
    );
  });

  test('falls back for unsupported schemes, empty strings, and non-string values', () => {
    for (const invalid of [
      'ftp://mediamtx.test',
      'ws://mediamtx.test:9997',
      'http://',
      '',
      '   ',
      9997,
      null,
      undefined,
      { host: 'mediamtx.test' },
    ]) {
      setPersisted(APP_PREFERENCES_STORAGE_KEY, {
        theme: 'light',
        serverUrl: invalid as unknown as string,
      });
      useAppStore.persist.rehydrate();

      expect(useAppStore.getState().theme).toBe('light');
      expect(useAppStore.getState().serverUrl).toBe('http://localhost:9997');
    }
  });

  test('falls back for the serverUrl independently while restoring a valid theme', () => {
    setPersisted(APP_PREFERENCES_STORAGE_KEY, {
      theme: 'light',
      serverUrl: 'localhost:9997',
    });
    useAppStore.persist.rehydrate();

    expect(useAppStore.getState()).toMatchObject({
      theme: 'light',
      serverUrl: 'http://localhost:9997',
    });
  });

  test('cold store initialization rejects a schemeless persisted serverUrl and uses the default', () => {
    setPersisted(APP_PREFERENCES_STORAGE_KEY, {
      theme: 'dark',
      serverUrl: 'localhost:9997',
    });
    const coldAppStore = createAppStore(storage);

    expect(coldAppStore.getState().serverUrl).toBe('http://localhost:9997');
  });

  test('cold store initialization restores a valid persisted http serverUrl', () => {
    setPersisted(APP_PREFERENCES_STORAGE_KEY, {
      theme: 'dark',
      serverUrl: 'https://cold.mediamtx.test:9997',
    });
    const coldAppStore = createAppStore(storage);

    expect(coldAppStore.getState().serverUrl).toBe(
      'https://cold.mediamtx.test:9997',
    );
  });
});

describe('setServerUrl save boundary', () => {
  test('commits and resets the API cache for a valid http URL', () => {
    useMediaMTXApiStore
      .getState()
      .setPathsSuccess(pathsListWith('prior-camera'));

    useAppStore.getState().setServerUrl('http://updated.mediamtx.test:9997');

    expect(useAppStore.getState().serverUrl).toBe(
      'http://updated.mediamtx.test:9997',
    );
    expect(useMediaMTXApiStore.getState().serverUrl).toBe(
      'http://updated.mediamtx.test:9997',
    );
    expect(useMediaMTXApiStore.getState().paths.data).toBeUndefined();
  });

  test('commits a valid https URL', () => {
    useAppStore.getState().setServerUrl('https://secure.mediamtx.test');

    expect(useAppStore.getState().serverUrl).toBe(
      'https://secure.mediamtx.test',
    );
    expect(useMediaMTXApiStore.getState().serverUrl).toBe(
      'https://secure.mediamtx.test',
    );
  });

  test('trims and commits a valid URL with surrounding whitespace', () => {
    useAppStore.getState().setServerUrl('   http://padded.mediamtx.test   ');

    expect(useAppStore.getState().serverUrl).toBe(
      'http://padded.mediamtx.test',
    );
    expect(useMediaMTXApiStore.getState().serverUrl).toBe(
      'http://padded.mediamtx.test',
    );
  });

  test('rejects a schemeless URL: state, API cache, and API store URL stay unchanged', () => {
    useAppStore.getState().setServerUrl('http://before.mediamtx.test');
    useMediaMTXApiStore
      .getState()
      .setPathsSuccess(pathsListWith('prior-camera'));

    useAppStore.getState().setServerUrl('localhost:9997');

    expect(useAppStore.getState().serverUrl).toBe(
      'http://before.mediamtx.test',
    );
    expect(useMediaMTXApiStore.getState().serverUrl).toBe(
      'http://before.mediamtx.test',
    );
    expect(useMediaMTXApiStore.getState().paths.data?.items).toHaveLength(1);
  });

  test('rejects empty, blank, and non-http-scheme values without changing state or API URL', () => {
    useAppStore.getState().setServerUrl('http://keep.mediamtx.test');

    for (const invalid of [
      '',
      '   ',
      'localhost:9997',
      '127.0.0.1:9997',
      'ftp://x',
      'http://',
      'not a url',
    ]) {
      useAppStore.getState().setServerUrl(invalid);

      expect(useAppStore.getState().serverUrl).toBe(
        'http://keep.mediamtx.test',
      );
      expect(useMediaMTXApiStore.getState().serverUrl).toBe(
        'http://keep.mediamtx.test',
      );
    }
  });

  test('does not throw when rejecting an invalid URL', () => {
    expect(() =>
      useAppStore.getState().setServerUrl('localhost:9997'),
    ).not.toThrow();
    expect(() => useAppStore.getState().setServerUrl('')).not.toThrow();
    expect(() =>
      useAppStore.getState().setServerUrl('ftp://mediamtx.test'),
    ).not.toThrow();
  });

  test('persists the trimmed URL after a valid save and leaves persistence unchanged after an invalid save', () => {
    useAppStore.getState().setServerUrl('http://saved.mediamtx.test:9997');
    expect(readPersistedServerUrl(APP_PREFERENCES_STORAGE_KEY)).toBe(
      'http://saved.mediamtx.test:9997',
    );

    useAppStore.getState().setServerUrl('localhost:9997');
    expect(readPersistedServerUrl(APP_PREFERENCES_STORAGE_KEY)).toBe(
      'http://saved.mediamtx.test:9997',
    );
  });
});

describe('apiFetch uses the validated server URL', () => {
  test('builds requests against the accepted URL after a rejected invalid save', async () => {
    const requests: string[] = [];
    useAppStore.getState().setServerUrl('http://api.mediamtx.test');
    globalThis.fetch = (async (input) => {
      requests.push(String(input));
      return jsonResponse({ version: 'v1.0.0' });
    }) as typeof fetch;

    useAppStore.getState().setServerUrl('localhost:9997');
    await apiFetch('/v3/info');

    expect(requests).toEqual(['http://api.mediamtx.test/v3/info']);
  });
});

describe('AppSidebar server URL editor validation', () => {
  async function renderExpandedSidebar(initialServerUrl: string) {
    resetStores(initialServerUrl);
    installFakeDom();

    await act(async () => {
      renderer = create(
        createElement(
          SSRProvider,
          null,
          createElement(
            MemoryRouter,
            { initialEntries: ['/'] },
            createElement(AppSidebar),
          ),
        ),
      );
      await flushMicrotasks();
    });
    return renderer!.root;
  }

  async function openEditor(root: ReactTestInstance) {
    const toggle = findNodeById(root, 'server-url-edit-btn');
    expect(toggle).not.toBeNull();
    await act(async () => {
      toggle!.props.onClick();
      await flushMicrotasks();
    });
  }

  async function typeInto(root: ReactTestInstance, value: string) {
    const input = findNodeById(root, 'server-url-input');
    expect(input).not.toBeNull();
    await act(async () => {
      input!.props.onChange(undefined, { value });
      await flushMicrotasks();
    });
  }

  async function clickSave(root: ReactTestInstance) {
    const save = findNodeById(root, 'server-url-save');
    expect(save).not.toBeNull();
    await act(async () => {
      save!.props.onClick();
      await flushMicrotasks();
    });
  }

  function editorIsOpen(root: ReactTestInstance) {
    return findNodeById(root, 'server-url-input') !== null;
  }

  test('rejects a schemeless URL on save, keeps the editor open, and shows a validation message', async () => {
    const root = await renderExpandedSidebar('http://sidebar.mediamtx.test');

    await openEditor(root);
    await typeInto(root, 'localhost:9997');
    await clickSave(root);

    expect(useAppStore.getState().serverUrl).toBe(
      'http://sidebar.mediamtx.test',
    );
    expect(useMediaMTXApiStore.getState().serverUrl).toBe(
      'http://sidebar.mediamtx.test',
    );
    expect(editorIsOpen(root)).toBe(true);
    expect(treeContainsText(root, 'Enter a full http:// or https:// URL')).toBe(
      true,
    );
  });

  test('accepts and trims a valid URL on save, closing the editor and committing the store', async () => {
    const root = await renderExpandedSidebar('http://sidebar.mediamtx.test');

    await openEditor(root);
    await typeInto(root, '   http://valid.mediamtx.test:9997   ');
    await clickSave(root);

    expect(useAppStore.getState().serverUrl).toBe(
      'http://valid.mediamtx.test:9997',
    );
    expect(useMediaMTXApiStore.getState().serverUrl).toBe(
      'http://valid.mediamtx.test:9997',
    );
    expect(editorIsOpen(root)).toBe(false);
  });

  test('Enter on an invalid URL keeps the editor open; Escape cancels and closes without committing', async () => {
    const root = await renderExpandedSidebar('http://sidebar.mediamtx.test');

    await openEditor(root);
    await typeInto(root, 'ftp://bad.mediamtx.test');
    const input = findNodeById(root, 'server-url-input');
    await act(async () => {
      input!.props.onKeyDown({ key: 'Enter' });
      await flushMicrotasks();
    });

    expect(editorIsOpen(root)).toBe(true);
    expect(treeContainsText(root, 'Enter a full http:// or https:// URL')).toBe(
      true,
    );

    await act(async () => {
      findNodeById(root, 'server-url-input')!.props.onKeyDown({
        key: 'Escape',
      });
      await flushMicrotasks();
    });

    expect(editorIsOpen(root)).toBe(false);
    expect(useAppStore.getState().serverUrl).toBe(
      'http://sidebar.mediamtx.test',
    );
  });

  test('typing after an error clears the validation message', async () => {
    const root = await renderExpandedSidebar('http://sidebar.mediamtx.test');

    await openEditor(root);
    await typeInto(root, 'localhost:9997');
    await clickSave(root);
    expect(treeContainsText(root, 'Enter a full http:// or https:// URL')).toBe(
      true,
    );

    await typeInto(root, 'http://fixing.mediamtx.test');
    expect(treeContainsText(root, 'Enter a full http:// or https:// URL')).toBe(
      false,
    );
  });

  test('empty input on save keeps the editor open and shows the required message', async () => {
    const root = await renderExpandedSidebar('http://sidebar.mediamtx.test');

    await openEditor(root);
    await typeInto(root, '   ');
    await clickSave(root);

    expect(useAppStore.getState().serverUrl).toBe(
      'http://sidebar.mediamtx.test',
    );
    expect(editorIsOpen(root)).toBe(true);
    expect(treeContainsText(root, 'Enter a MediaMTX API endpoint URL')).toBe(
      true,
    );
  });
});
