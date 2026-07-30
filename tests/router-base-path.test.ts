import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from '@src/App';
import AppLayout from '@src/components/layout/AppLayout';
import AppSidebar from '@src/components/layout/AppSidebar';
import { DASHBOARD_ROUTE, STREAMS_ROUTE } from '@src/router/routes';
import { pathToTab } from '@src/components/layout/AppSidebar';
import useAppStore from '@src/store/useAppStore';
import useMediaMTXApiStore from '@src/store/useMediaMTXApiStore';

const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

let renderer: ReactTestRenderer | undefined;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installApiMock() {
  globalThis.fetch = (async (input) => {
    const url = String(input);

    if (url.endsWith('/v3/paths/list')) {
      return jsonResponse({ itemCount: 0, pageCount: 1, items: [] });
    }

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

    if (url.endsWith('/v3/info')) {
      return jsonResponse({ version: 'v1.0.0', started: '2026-07-30T00:00:00Z' });
    }

    return jsonResponse({ error: 'not found' }, 404);
  }) as typeof fetch;
}

function makeFakeBrowser(pathAndHash: string) {
  const initialUrl = new URL(pathAndHash, 'https://example.test');
  const location = {
    assign: (url: string) => updateLocation(url),
    hash: initialUrl.hash,
    href: initialUrl.href,
    origin: initialUrl.origin,
    pathname: initialUrl.pathname,
    search: initialUrl.search,
  };
  const listeners = new Map<string, Set<() => void>>();
  const history = {
    state: null as unknown,
    go: () => undefined,
    pushState: (state: unknown, _title: string, url?: string | URL | null) => {
      history.state = state;
      if (url !== undefined && url !== null) updateLocation(String(url));
    },
    replaceState: (state: unknown, _title: string, url?: string | URL | null) => {
      history.state = state;
      if (url !== undefined && url !== null) updateLocation(String(url));
    },
  };

  function updateLocation(url: string) {
    const next = new URL(url, location.href);
    location.hash = next.hash;
    location.href = next.href;
    location.origin = next.origin;
    location.pathname = next.pathname;
    location.search = next.search;
  }

  const fakeWindow = {
    addEventListener: (type: string, listener: () => void) => {
      const typeListeners = listeners.get(type) ?? new Set<() => void>();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    document: null as unknown,
    history,
    location,
    removeEventListener: (type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    },
  };
  const fakeDocument = {
    defaultView: fakeWindow,
    documentElement: {
      classList: {
        add: () => undefined,
        remove: () => undefined,
      },
    },
    querySelector: () => null,
  };
  fakeWindow.document = fakeDocument;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: fakeDocument,
  });

  return fakeWindow;
}

function restoreBrowserGlobals() {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }

  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'document');
  }
}

async function flushMicrotasks() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function getPrimaryNav(root: ReactTestInstance) {
  return root.find(
    (node) =>
      node.props['aria-label'] === 'Primary navigation' &&
      typeof node.props.onNavItemSelect === 'function'
  );
}

function getNavButtonByValue(root: ReactTestInstance, value: string) {
  return root.find((node) => node.type === 'button' && node.props.value === value);
}

function renderLayoutMarkup(initialPath: string) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [initialPath] }, createElement(AppLayout))
  );
}

function getServerVisibleRequestPath(url: string) {
  const parsedUrl = new URL(url);

  return `${parsedUrl.pathname}${parsedUrl.search}`;
}

beforeEach(() => {
  installApiMock();
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({
    activeTab: 'dashboard',
    isSidebarCollapsed: false,
    serverUrl: 'http://router.mediamtx.test',
    theme: 'dark',
  });
  useMediaMTXApiStore.getState().resetForServerUrl('http://router.mediamtx.test');
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
    renderer = undefined;
    await flushMicrotasks();
  });
  globalThis.fetch = originalFetch;
  restoreBrowserGlobals();
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({
    activeTab: 'dashboard',
    isSidebarCollapsed: false,
    serverUrl: 'http://localhost:9997',
    theme: 'dark',
  });
});

describe('React Router hash routing', () => {
  test('declares react-router-dom as an application dependency', async () => {
    const packageJson = await Bun.file('package.json').json();
    const appSource = await Bun.file('src/App.tsx').text();
    const sidebarSource = await Bun.file('src/components/layout/AppSidebar.tsx').text();

    expect(packageJson.dependencies['react-router-dom']).toBeDefined();
    expect(appSource).toContain('HashRouter');
    expect(appSource).not.toContain('BrowserRouter');
    expect(appSource).toContain('<AppRouter>');
    expect(sidebarSource).toContain('useNavigate');
    expect(sidebarSource).not.toContain('history.pushState');
  });

  test('navigates through App HashRouter while preserving a non-root served base path', async () => {
    const fakeWindow = makeFakeBrowser('/tenant/console');

    await act(async () => {
      renderer = create(createElement(AppRouter, null, createElement(AppSidebar)));
      await flushMicrotasks();
    });

    const primaryNav = getPrimaryNav(renderer!.root);
    const streamsButton = getNavButtonByValue(renderer!.root, 'streams');
    const clickEvent = {
      defaultPrevented: false,
      preventDefault: () => undefined,
    };

    await act(async () => {
      streamsButton.props.onClick?.(clickEvent);
      primaryNav.props.onNavItemSelect(clickEvent, { value: 'streams' });
      await flushMicrotasks();
    });

    expect(fakeWindow.location.href).toBe('https://example.test/tenant/console#/streams');
    expect(fakeWindow.location.pathname).toBe('/tenant/console');
    expect(fakeWindow.location.hash).toBe('#/streams');
    expect(useAppStore.getState().activeTab).toBe('streams');
  });

  test('keeps routed Streams refreshes on the deployment base path visible to the server', () => {
    const rootStreamsUrl = 'https://example.test/#/streams';
    const basePathStreamsUrl = 'https://example.test/tenant/console#/streams';
    const cleanStreamsUrl = 'https://example.test/streams';

    expect(getServerVisibleRequestPath(rootStreamsUrl)).toBe('/');
    expect(getServerVisibleRequestPath(basePathStreamsUrl)).toBe('/tenant/console');
    expect(new URL(basePathStreamsUrl).hash).toBe('#/streams');
    expect(getServerVisibleRequestPath(cleanStreamsUrl)).toBe('/streams');
  });

  test('renders Dashboard content for the hash/router root route', async () => {
    const markup = renderLayoutMarkup(DASHBOARD_ROUTE);

    expect(markup).toContain('>Server Dashboard</h1>');
    expect(markup).not.toContain('>Streams</h1>');
  });

  test('renders Streams content for the hash/router Streams route', async () => {
    const markup = renderLayoutMarkup(STREAMS_ROUTE);

    expect(markup).toContain('>Streams</h1>');
    expect(markup).not.toContain('>Server Dashboard</h1>');
  });

  test('syncs sidebar selected state to router paths', async () => {
    const sidebarSource = await Bun.file('src/components/layout/AppSidebar.tsx').text();

    expect(sidebarSource).toContain('setActiveTab(pathToTab(location.pathname))');
    expect(pathToTab(DASHBOARD_ROUTE)).toBe('dashboard');
    expect(pathToTab(STREAMS_ROUTE)).toBe('streams');
  });
});
