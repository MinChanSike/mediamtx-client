import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement, Fragment } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppSidebar from '@src/components/layout/AppSidebar';
import useAppStore from '@src/store/useAppStore';
import useMediaMTXApiStore from '@src/store/useMediaMTXApiStore';
import usePlaybackSyncStore from '@src/store/usePlaybackSyncStore';

const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

let renderer: ReactTestRenderer | undefined;
let currentRoutePathname = '/';

function LocationRecorder() {
  currentRoutePathname = useLocation().pathname;
  return null;
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
        playback: true,
        playbackAddress: ':9996',
        playbackEncryption: false,
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

function restoreWindow() {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

async function renderSidebar(initialPath = '/') {
  await act(async () => {
    renderer = create(
      createElement(
        MemoryRouter,
        { initialEntries: [initialPath] },
        createElement(
          Fragment,
          null,
          createElement(AppSidebar),
          createElement(LocationRecorder)
        )
      )
    );
    await flushMicrotasks();
  });

  return renderer;
}

function getButtonByAriaLabel(root: ReactTestInstance, ariaLabel: string) {
  return root.find(
    (node) => node.type === 'button' && node.props['aria-label'] === ariaLabel
  );
}

function getNavButtonByValue(root: ReactTestInstance, value: string) {
  return root.find((node) => node.type === 'button' && node.props.value === value);
}

beforeEach(() => {
  installGlobalConfigMock();
  currentRoutePathname = '/';
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({
    activeTab: 'dashboard',
    isSidebarCollapsed: true,
    serverUrl: 'http://sidebar.mediamtx.test',
    theme: 'dark',
  });
  useMediaMTXApiStore.getState().resetForServerUrl('http://sidebar.mediamtx.test');
  usePlaybackSyncStore.setState({ endpointOverrides: {} });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      history: {
        pushState: () => undefined,
      },
      location: {
        pathname: '/',
      },
    },
  });
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
    renderer = undefined;
    await flushMicrotasks();
  });
  globalThis.fetch = originalFetch;
  restoreWindow();
  useMediaMTXApiStore.getState().resetForServerUrl('');
  usePlaybackSyncStore.setState({ endpointOverrides: {} });
  useAppStore.setState({
    activeTab: 'dashboard',
    isSidebarCollapsed: false,
    serverUrl: 'http://localhost:9997',
    theme: 'dark',
  });
});

describe('collapsed AppSidebar behavior', () => {
  test('rendered collapsed controls expand the sidebar and toggle theme', async () => {
    await renderSidebar();

    const expandButton = getButtonByAriaLabel(renderer!.root, 'Expand sidebar');
    const themeButton = getButtonByAriaLabel(renderer!.root, 'Switch to light mode');
    expect(useAppStore.getState().isSidebarCollapsed).toBe(true);
    expect(useAppStore.getState().theme).toBe('dark');

    await act(async () => {
      themeButton.props.onClick();
      await flushMicrotasks();
    });
    expect(useAppStore.getState().theme).toBe('light');

    await act(async () => {
      expandButton.props.onClick();
      await flushMicrotasks();
    });

    expect(useAppStore.getState().isSidebarCollapsed).toBe(false);
  });

  test('rendered collapsed navigation items keep labels and navigate through React Router', async () => {
    await renderSidebar();

    const dashboardButton = getNavButtonByValue(renderer!.root, 'dashboard');
    const streamsButton = getNavButtonByValue(renderer!.root, 'streams');
    expect(dashboardButton.props.title).toBe('Dashboard');
    expect(streamsButton.props.title).toBe('Streams');
    expect(renderer!.root.findAll((node) => node.props.content === 'Dashboard')).toHaveLength(1);
    expect(renderer!.root.findAll((node) => node.props.content === 'Streams')).toHaveLength(1);
    expect(dashboardButton.children).not.toContain('Dashboard');
    expect(streamsButton.children).not.toContain('Streams');

    const clickEvent = {
      defaultPrevented: false,
      preventDefault: () => undefined,
      target: { nodeName: 'path', namespaceURI: 'http://www.w3.org/2000/svg' },
    };

    await act(async () => {
      streamsButton.props.onClick(clickEvent);
      await flushMicrotasks();
    });
    expect(useAppStore.getState().activeTab).toBe('streams');
    expect(currentRoutePathname).toBe('/streams');

    await act(async () => {
      dashboardButton.props.onClick(clickEvent);
      await flushMicrotasks();
    });
    expect(useAppStore.getState().activeTab).toBe('dashboard');
    expect(currentRoutePathname).toBe('/');
  });

  test.each([true, false])('icon clicks navigate every route when collapsed=%s', async (collapsed) => {
    useAppStore.setState({ isSidebarCollapsed: collapsed });
    await renderSidebar();

    for (const [value, path] of [
      ['streams', '/streams'],
      ['playback', '/playback'],
      ['playback-sync', '/playback-sync'],
      ['dashboard', '/'],
    ]) {
      await act(async () => {
        getNavButtonByValue(renderer!.root, value).props.onClick({
          defaultPrevented: false,
          preventDefault: () => undefined,
          target: { nodeName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg' },
        });
        await flushMicrotasks();
      });

      expect(currentRoutePathname).toBe(path);
      expect(useAppStore.getState().activeTab).toBe(value);
      expect(getNavButtonByValue(renderer!.root, value).props['aria-current']).toBe('page');
      expect(useAppStore.getState().isSidebarCollapsed).toBe(collapsed);
    }
  });

  test('syncs collapsed sidebar selected state from the current route on initial render', async () => {
    await renderSidebar('/streams');

    expect(useAppStore.getState().activeTab).toBe('streams');
  });

  test('edits the server API and playback server endpoints together', async () => {
    await renderSidebar();

    await act(async () => {
      getButtonByAriaLabel(renderer!.root, 'Expand sidebar').props.onClick();
      await flushMicrotasks();
    });

    await act(async () => {
      getButtonByAriaLabel(renderer!.root, 'Edit server endpoints').props.onClick();
      await flushMicrotasks();
    });

    const fields = renderer!.root.findAll((node) => node.type === 'label');
    expect(fields.some((node) => node.children.includes('Server API endpoint'))).toBe(true);
    expect(fields.some((node) => node.children.includes('Playback server endpoint'))).toBe(true);

    const apiInput = renderer!.root.find(
      (node) => node.type === 'input' && node.props.id === 'server-url-input'
    );
    const playbackInput = renderer!.root.find(
      (node) => node.type === 'input' && node.props.id === 'playback-server-url-input'
    );

    await act(async () => {
      apiInput.props.onChange(
        { target: { value: 'http://new-api.test:9997' } },
        { value: 'http://new-api.test:9997' }
      );
      playbackInput.props.onChange(
        { target: { value: 'http://new-playback.test:9996' } },
        { value: 'http://new-playback.test:9996' }
      );
      await flushMicrotasks();
    });

    const saveButton = renderer!.root.find(
      (node) => node.type === 'button' && node.props.id === 'server-url-save'
    );
    await act(async () => {
      saveButton.props.onClick();
      await flushMicrotasks();
    });

    expect(useAppStore.getState().serverUrl).toBe('http://new-api.test:9997');
    expect(usePlaybackSyncStore.getState().endpointOverrides['http://new-api.test:9997']).toBe(
      'http://new-playback.test:9996'
    );
  });
});
