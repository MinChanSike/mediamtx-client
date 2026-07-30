import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement, Fragment } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppSidebar from '@src/components/layout/AppSidebar';
import useAppStore from '@src/store/useAppStore';
import useMediaMTXApiStore from '@src/store/useMediaMTXApiStore';

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

function getPrimaryNav(root: ReactTestInstance) {
  return root.find(
    (node) =>
      node.props['aria-label'] === 'Primary navigation' &&
      typeof node.props.onNavItemSelect === 'function'
  );
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

    const primaryNav = getPrimaryNav(renderer!.root);
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
    };

    await act(async () => {
      streamsButton.props.onClick?.(clickEvent);
      primaryNav.props.onNavItemSelect(clickEvent, { value: 'streams' });
      await flushMicrotasks();
    });
    expect(useAppStore.getState().activeTab).toBe('streams');
    expect(currentRoutePathname).toBe('/streams');

    await act(async () => {
      dashboardButton.props.onClick?.(clickEvent);
      primaryNav.props.onNavItemSelect(clickEvent, { value: 'dashboard' });
      await flushMicrotasks();
    });
    expect(useAppStore.getState().activeTab).toBe('dashboard');
    expect(currentRoutePathname).toBe('/');
  });

  test('syncs collapsed sidebar selected state from the current route on initial render', async () => {
    await renderSidebar('/streams');

    expect(useAppStore.getState().activeTab).toBe('streams');
  });
});
