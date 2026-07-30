import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  getApiIntegrationSnapshot,
  mountGlobalConfigConsumer,
  mountPathsConsumer,
  mountServerInfoConsumer,
  refreshGlobalConfigNow,
  refreshPathDetailNow,
  refreshPathsNow,
  refreshRawConfigNow,
  refreshServerInfoNow,
  refreshViewerDetailNow,
  runAddStreamMutation,
  runDeleteStreamMutation,
  runEditStreamMutation,
  runKickStreamTargetMutation,
  useStoreBackedGlobalConfig,
  useStoreBackedPathDetail,
  useStoreBackedPaths,
  useStoreBackedRawConfig,
  useStoreBackedServerInfo,
  useStoreBackedViewerDetail,
} from '../src/hooks/useMediaMTXApi';
import useAppStore from '../src/store/useAppStore';
import useMediaMTXApiStore from '../src/store/useMediaMTXApiStore';
import { getApiAvailabilityStatus } from '../src/utils/apiAvailabilityStatus';

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

type FakeTimerEntry = {
  id: number;
  delay: number;
  dueAt: number;
  handler: TimerHandler;
  args: unknown[];
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function globalConfigData(logLevel: string) {
  return {
    logLevel,
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
  };
}

function globalConfigResponse(logLevel: string) {
  return jsonResponse(globalConfigData(logLevel));
}

function resetStores(serverUrl = 'http://mediamtx.test') {
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({ serverUrl });
  useMediaMTXApiStore.getState().resetForServerUrl(serverUrl);
}

function installApiMock(requests: string[], overrides: Record<string, Response | undefined> = {}) {
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    requests.push(`${init?.method ?? 'GET'} ${url}`);

    if (overrides[url]) return overrides[url] as Response;
    if (url.endsWith('/v3/paths/list')) {
      return jsonResponse({
        itemCount: 1,
        pageCount: 1,
        items: [
          {
            name: 'camera-1',
            source: 'publisher',
            sourceError: '',
            tracks: [],
            bytesReceived: 10,
            bytesSent: 20,
            readers: [],
          },
        ],
      });
    }
    if (url.endsWith('/v3/config/paths/list')) {
      return jsonResponse({
        itemCount: 1,
        pageCount: 1,
        items: [{ name: 'camera-1', source: 'rtsp://camera-1/live' }],
      });
    }
    if (url.endsWith('/v3/info')) {
      return jsonResponse({
        version: 'v1.12.3',
        started: new Date(Date.now() - 30_000).toISOString(),
      });
    }
    if (url.endsWith('/v3/config/global/get')) {
      return globalConfigResponse('info');
    }
    if (url.endsWith('/v3/config/pathdefaults/get')) {
      return jsonResponse({ source: 'publisher', record: false });
    }
    if (url.endsWith('/v3/paths/get/camera-1')) {
      return jsonResponse({ name: 'camera-1', ready: true });
    }
    if (url.endsWith('/v3/rtmpconns/get/viewer-1')) {
      return jsonResponse({ id: 'viewer-1', state: 'read' });
    }
    if (url.endsWith('/v3/config/paths/add/camera-2')) {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/v3/config/paths/patch/camera-1')) {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/v3/config/paths/delete/camera-1')) {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/v3/rtmpconns/kick/viewer-1')) {
      return new Response(null, { status: 204 });
    }

    return jsonResponse({ error: 'not found' }, 404);
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  resetStores();
});

function installFakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, FakeTimerEntry>();

  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const delay = Math.max(0, Number(timeout ?? 0));
    const id = nextId;
    nextId += 1;
    timers.set(id, {
      id,
      delay,
      dueAt: now + delay,
      handler,
      args,
    });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  globalThis.clearTimeout = ((timeoutId?: string | number | NodeJS.Timeout) => {
    timers.delete(Number(timeoutId));
  }) as typeof clearTimeout;

  return {
    advanceBy(ms: number) {
      const target = now + ms;

      while (true) {
        const nextTimer = Array.from(timers.values())
          .filter((timer) => timer.dueAt <= target)
          .sort((a, b) => a.dueAt - b.dueAt || a.id - b.id)[0];

        if (!nextTimer) break;

        timers.delete(nextTimer.id);
        now = nextTimer.dueAt;
        if (typeof nextTimer.handler === 'function') {
          nextTimer.handler(...nextTimer.args);
        }
      }

      now = target;
    },
    pendingByDelay(delay: number) {
      return Array.from(timers.values()).filter((timer) => timer.delay === delay).length;
    },
    uninstall() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

async function flushAsyncWork() {
  await act(async () => {
    await flushMicrotasks();
  });
}

async function advanceTimers(
  timers: ReturnType<typeof installFakeTimers>,
  milliseconds: number
) {
  await act(async () => {
    timers.advanceBy(milliseconds);
    await flushMicrotasks();
  });
}

function countRequestsEndingWith(requests: string[], suffix: string) {
  return requests.filter((request) => request.endsWith(suffix)).length;
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

function getStreamsContentGateSnapshot() {
  const resource = useMediaMTXApiStore.getState().paths;
  const isLoading = resource.isLoading || (resource.data === undefined && !resource.error);
  const isError = !!resource.error;

  return {
    data: resource.data,
    error: resource.error,
    isLoading,
    isError,
    isSuccess: resource.data !== undefined && !resource.error,
    canRenderStreamsContent: !isLoading && !isError,
  };
}

describe('MediaMTX API Zustand store integration', () => {
  test('stores successful paths, server info, config, raw config, and detail fetches in Zustand', async () => {
    const requests: string[] = [];
    resetStores();
    installApiMock(requests);

    await refreshPathsNow();
    await refreshServerInfoNow();
    await refreshGlobalConfigNow();
    await refreshRawConfigNow();
    await refreshPathDetailNow('camera-1');
    await refreshViewerDetailNow({ id: 'viewer-1', type: 'rtmpConn', endpoint: 'rtmpconns' });

    const state = useMediaMTXApiStore.getState();
    expect(state.paths.data?.items[0]).toMatchObject({
      name: 'camera-1',
      source: 'rtsp://camera-1/live',
      isConfigured: true,
    });
    expect(state.serverInfo.data).toMatchObject({
      version: 'v1.12.3',
    });
    expect(state.serverInfo.data?.uptime).toBeGreaterThanOrEqual(30);
    expect(state.serverInfo.data?.uptime).toBeLessThan(32);
    expect(state.globalConfig.data?.apiAddress).toBe('127.0.0.1:9997');
    expect(state.rawConfig.data?.pathDefaults).toEqual({ source: 'publisher', record: false });
    expect(state.pathDetails['camera-1'].data).toEqual({ name: 'camera-1', ready: true });
    expect(state.viewerDetails['rtmpconns:viewer-1'].data).toEqual({
      id: 'viewer-1',
      state: 'read',
    });
    expect(requests).toContain('GET http://mediamtx.test/v3/paths/list');
    expect(requests).toContain('GET http://mediamtx.test/v3/config/paths/list');
    expect(requests).toContain('GET http://mediamtx.test/v3/info');
  });

  test('merges matching config path metadata while preserving runtime stream state', async () => {
    const requests: string[] = [];
    resetStores();
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      requests.push(`${init?.method ?? 'GET'} ${url}`);

      if (url.endsWith('/v3/paths/list')) {
        return jsonResponse({
          itemCount: 2,
          pageCount: 1,
          items: [
            {
              name: 'configured-camera',
              source: { type: 'publisher', url: 'rtsp://runtime/source' },
              sourceState: 'ready',
              sourceError: 'runtime-source-error',
              online: true,
              available: true,
              ready: true,
              tracks: [{ id: 7, type: 'video' }],
              bytesReceived: 1234,
              bytesSent: 5678,
              readers: [{ id: 'reader-1', type: 'rtspSession', state: 'read' }],
            },
            {
              name: 'runtime-only',
              source: 'publisher',
              sourceState: 'notReady',
              sourceError: '',
              online: false,
              available: false,
              ready: false,
              tracks: [],
              bytesReceived: 10,
              bytesSent: 20,
              readers: [],
            },
          ],
        });
      }

      if (url.endsWith('/v3/config/paths/list')) {
        return jsonResponse({
          itemCount: 3,
          pageCount: 1,
          items: [
            {
              name: 'configured-camera',
              source: 'rtsp://configured/source',
              sourceState: 'config-state-should-not-win',
              sourceError: 'config-error-should-not-win',
              online: false,
              available: false,
              ready: false,
              tracks: [{ id: 99, type: 'audio' }],
              bytesReceived: 9999,
              bytesSent: 8888,
              readers: [{ id: 'config-reader', type: 'hlsMuxer', state: 'read' }],
              runOnInit: 'echo configured',
            },
            { name: '**all_others', source: 'publisher' },
            { name: 'config-only', source: 'rtsp://configured/only' },
          ],
        });
      }

      return jsonResponse({ error: 'not found' }, 404);
    }) as typeof fetch;

    await refreshPathsNow();

    const items = useMediaMTXApiStore.getState().paths.data?.items ?? [];
    const configuredCamera = items.find((item) => item.name === 'configured-camera');
    const runtimeOnly = items.find((item) => item.name === 'runtime-only');

    expect(requests).toContain('GET http://mediamtx.test/v3/paths/list');
    expect(requests).toContain('GET http://mediamtx.test/v3/config/paths/list');
    expect(items.map((item) => item.name)).toEqual(['configured-camera', 'runtime-only']);
    expect(configuredCamera).toMatchObject({
      name: 'configured-camera',
      source: 'rtsp://configured/source',
      sourceInfo: { type: 'publisher', url: 'rtsp://runtime/source' },
      sourceState: 'ready',
      sourceError: 'runtime-source-error',
      online: true,
      available: true,
      ready: true,
      tracks: [{ id: 7, type: 'video' }],
      bytesReceived: 1234,
      bytesSent: 5678,
      readers: [{ id: 'reader-1', type: 'rtspSession', state: 'read' }],
      runOnInit: 'echo configured',
      isConfigured: true,
    });
    expect(runtimeOnly).toMatchObject({
      name: 'runtime-only',
      source: 'publisher',
      ready: false,
    });
    expect(runtimeOnly?.isConfigured).toBeUndefined();
    expect(items.find((item) => item.name === '**all_others')).toBeUndefined();
    expect(items.find((item) => item.name === 'config-only')).toBeUndefined();
  });

  test('excludes the MediaMTX fallback path when it appears in runtime paths', async () => {
    resetStores();
    globalThis.fetch = (async (input) => {
      const url = String(input);

      if (url.endsWith('/v3/paths/list')) {
        return jsonResponse({
          itemCount: 2,
          pageCount: 1,
          items: [
            {
              name: '**all_others',
              source: 'publisher',
              sourceError: '',
              tracks: [],
              bytesReceived: 0,
              bytesSent: 0,
              readers: [],
            },
            {
              name: 'camera-1',
              source: 'publisher',
              sourceError: '',
              tracks: [],
              bytesReceived: 10,
              bytesSent: 20,
              readers: [],
            },
          ],
        });
      }

      if (url.endsWith('/v3/config/paths/list')) {
        return jsonResponse({
          itemCount: 1,
          pageCount: 1,
          items: [{ name: '**all_others', source: 'publisher' }],
        });
      }

      return jsonResponse({ error: 'not found' }, 404);
    }) as typeof fetch;

    await refreshPathsNow();

    const items = useMediaMTXApiStore.getState().paths.data?.items ?? [];
    expect(items.map((item) => item.name)).toEqual(['camera-1']);
    expect(items[0]?.isConfigured).toBeUndefined();
  });

  test('stores resource errors without replacing them with fallback data', async () => {
    resetStores();
    globalThis.fetch = (async () => new Response('server error', { status: 500 })) as typeof fetch;

    await refreshPathsNow();
    await refreshServerInfoNow();

    const state = useMediaMTXApiStore.getState();
    expect(state.paths.data).toBeUndefined();
    expect(state.paths.error?.message).toContain('HTTP 500');
    expect(state.serverInfo.data).toBeUndefined();
    expect(state.serverInfo.error?.message).toContain('HTTP 500');
  });

  test('configures SWR for live polling and compatibility revalidation defaults', async () => {
    const snapshot = getApiIntegrationSnapshot();

    expect(snapshot).toMatchObject({
      swrCachePrefix: 'mediamtx-api',
      liveRefreshMs: 3000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshWhenHidden: true,
      refreshWhenOffline: true,
      shouldRetryOnError: false,
    });
  });

  test('legacy mount consumer exports remain cleanup-returning SWR compatibility shims', async () => {
    const requests: string[] = [];
    const timers = installFakeTimers();
    resetStores('http://legacy-mount-compat.mediamtx.test');
    installApiMock(requests);

    try {
      const cleanupPaths: () => void = mountPathsConsumer();
      const cleanupServerInfo: () => void = mountServerInfoConsumer();
      const cleanupGlobalConfig: () => void = mountGlobalConfigConsumer();

      expect(typeof cleanupPaths).toBe('function');
      expect(typeof cleanupServerInfo).toBe('function');
      expect(typeof cleanupGlobalConfig).toBe('function');

      cleanupPaths();
      cleanupServerInfo();
      cleanupGlobalConfig();
      await advanceTimers(timers, 9000);

      expect(requests).toHaveLength(0);
      expect(timers.pendingByDelay(3000)).toBe(0);
    } finally {
      timers.uninstall();
    }
  });

  test('mounted live hooks fetch immediately, poll at 3000 ms, and stop after unmount', async () => {
    const requests: string[] = [];
    const timers = installFakeTimers();
    resetStores('http://live-hooks.mediamtx.test');
    installApiMock(requests);

    function LiveConsumers() {
      useStoreBackedPaths();
      useStoreBackedServerInfo();
      useStoreBackedGlobalConfig();
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        renderer = create(createElement(LiveConsumers));
        await flushMicrotasks();
      });

      expect(countRequestsEndingWith(requests, '/v3/paths/list')).toBe(1);
      expect(countRequestsEndingWith(requests, '/v3/info')).toBe(1);
      expect(countRequestsEndingWith(requests, '/v3/config/global/get')).toBe(1);

      await advanceTimers(timers, 2999);
      expect(countRequestsEndingWith(requests, '/v3/paths/list')).toBe(1);
      expect(countRequestsEndingWith(requests, '/v3/info')).toBe(1);
      expect(countRequestsEndingWith(requests, '/v3/config/global/get')).toBe(1);

      await advanceTimers(timers, 1);
      expect(countRequestsEndingWith(requests, '/v3/paths/list')).toBe(2);
      expect(countRequestsEndingWith(requests, '/v3/info')).toBe(2);
      expect(countRequestsEndingWith(requests, '/v3/config/global/get')).toBe(2);

      await advanceTimers(timers, 3000);
      expect(countRequestsEndingWith(requests, '/v3/paths/list')).toBe(3);
      expect(countRequestsEndingWith(requests, '/v3/info')).toBe(3);
      expect(countRequestsEndingWith(requests, '/v3/config/global/get')).toBe(3);

      await act(async () => {
        renderer?.unmount();
        renderer = undefined;
        await flushMicrotasks();
      });
      const requestsAfterUnmount = requests.length;

      await advanceTimers(timers, 9000);
      expect(requests).toHaveLength(requestsAfterUnmount);
    } finally {
      await act(async () => {
        renderer?.unmount();
        await flushMicrotasks();
      });
      timers.uninstall();
    }
  });

  test('conditional non-polled hooks skip disabled and invalid resources', async () => {
    const requests: string[] = [];
    const timers = installFakeTimers();
    resetStores('http://conditional-disabled.mediamtx.test');
    installApiMock(requests);

    function DisabledConsumers() {
      useStoreBackedRawConfig(false);
      useStoreBackedPathDetail('camera-1', false);
      useStoreBackedPathDetail(null, true);
      useStoreBackedPathDetail('', true);
      useStoreBackedViewerDetail({ id: 'viewer-1', type: 'rtmpConn', endpoint: 'rtmpconns' }, false);
      useStoreBackedViewerDetail(null, true);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        renderer = create(createElement(DisabledConsumers));
        await flushMicrotasks();
      });

      expect(requests).toHaveLength(0);
      expect(timers.pendingByDelay(3000)).toBe(0);
      await advanceTimers(timers, 10_000);
      expect(requests).toHaveLength(0);
    } finally {
      await act(async () => {
        renderer?.unmount();
        await flushMicrotasks();
      });
      timers.uninstall();
    }
  });

  test('conditional non-polled hooks fetch enabled resources once without timer refetch', async () => {
    const requests: string[] = [];
    const timers = installFakeTimers();
    resetStores('http://conditional-enabled.mediamtx.test');
    installApiMock(requests);

    function EnabledConsumers() {
      useStoreBackedRawConfig(true);
      useStoreBackedPathDetail('camera-1', true);
      useStoreBackedViewerDetail({ id: 'viewer-1', type: 'rtmpConn', endpoint: 'rtmpconns' }, true);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        renderer = create(createElement(EnabledConsumers));
        await flushMicrotasks();
      });

      expect(requests).toContain('GET http://conditional-enabled.mediamtx.test/v3/config/global/get');
      expect(requests).toContain(
        'GET http://conditional-enabled.mediamtx.test/v3/config/pathdefaults/get'
      );
      expect(requests).toContain('GET http://conditional-enabled.mediamtx.test/v3/paths/get/camera-1');
      expect(requests).toContain(
        'GET http://conditional-enabled.mediamtx.test/v3/rtmpconns/get/viewer-1'
      );

      const requestsBeforeTimers = requests.length;
      await advanceTimers(timers, 10_000);
      expect(requests).toHaveLength(requestsBeforeTimers);
    } finally {
      await act(async () => {
        renderer?.unmount();
        await flushMicrotasks();
      });
      timers.uninstall();
    }
  });

  test('conditional detail hooks fetch when enabled after being disabled', async () => {
    const requests: string[] = [];
    const timers = installFakeTimers();
    resetStores('http://conditional-toggle.mediamtx.test');
    installApiMock(requests);

    function DisabledConsumers() {
      useStoreBackedRawConfig(false);
      useStoreBackedPathDetail('camera-1', false);
      useStoreBackedViewerDetail({ id: 'viewer-1', type: 'rtmpConn', endpoint: 'rtmpconns' }, false);
      return null;
    }

    function EnabledConsumers() {
      useStoreBackedRawConfig(true);
      useStoreBackedPathDetail('camera-1', true);
      useStoreBackedViewerDetail({ id: 'viewer-1', type: 'rtmpConn', endpoint: 'rtmpconns' }, true);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        renderer = create(createElement(DisabledConsumers));
        await flushMicrotasks();
      });
      expect(requests).toHaveLength(0);

      await act(async () => {
        renderer?.update(createElement(EnabledConsumers));
        await flushMicrotasks();
      });

      expect(requests).toContain('GET http://conditional-toggle.mediamtx.test/v3/config/global/get');
      expect(requests).toContain(
        'GET http://conditional-toggle.mediamtx.test/v3/config/pathdefaults/get'
      );
      expect(requests).toContain('GET http://conditional-toggle.mediamtx.test/v3/paths/get/camera-1');
      expect(requests).toContain(
        'GET http://conditional-toggle.mediamtx.test/v3/rtmpconns/get/viewer-1'
      );
    } finally {
      await act(async () => {
        renderer?.unmount();
        await flushMicrotasks();
      });
      timers.uninstall();
    }
  });

  test('server URL changes reset stale API data immediately', async () => {
    const requests: string[] = [];
    resetStores();
    installApiMock(requests);

    await refreshPathsNow();
    expect(useMediaMTXApiStore.getState().paths.data?.items).toHaveLength(1);

    useAppStore.getState().setServerUrl('http://other-mediamtx.test');

    const state = useMediaMTXApiStore.getState();
    expect(state.serverUrl).toBe('http://other-mediamtx.test');
    expect(state.paths.data).toBeUndefined();
    expect(state.serverInfo.data).toBeUndefined();
    expect(state.globalConfig.data).toBeUndefined();
    expect(state.rawConfig.data).toBeUndefined();
  });

  test('does not commit an in-flight response after the server URL changes', async () => {
    let resolveOldPaths: ((response: Response) => void) | undefined;
    resetStores('http://old-mediamtx.test');

    globalThis.fetch = (async (input) => {
      const url = String(input);

      if (url === 'http://old-mediamtx.test/v3/paths/list') {
        return new Promise<Response>((resolve) => {
          resolveOldPaths = resolve;
        });
      }
      if (url === 'http://old-mediamtx.test/v3/config/paths/list') {
        return jsonResponse({ itemCount: 0, pageCount: 1, items: [] });
      }

      return jsonResponse({ error: 'not found' }, 404);
    }) as typeof fetch;

    const refresh = refreshPathsNow();
    useAppStore.getState().setServerUrl('http://new-mediamtx.test');
    resolveOldPaths?.(
      jsonResponse({
        itemCount: 1,
        pageCount: 1,
        items: [
          {
            name: 'old-camera',
            source: 'publisher',
            sourceError: '',
            tracks: [],
            bytesReceived: 0,
            bytesSent: 0,
            readers: [],
          },
        ],
      })
    );
    await refresh;

    const state = useMediaMTXApiStore.getState();
    expect(state.serverUrl).toBe('http://new-mediamtx.test');
    expect(state.paths.data).toBeUndefined();
    expect(state.paths.error).toBeNull();
  });

  test('does not let an older same-server paths refresh overwrite a newer success', async () => {
    let resolveFirstPaths: ((response: Response) => void) | undefined;
    let resolveSecondPaths: ((response: Response) => void) | undefined;
    let pathListRequests = 0;
    resetStores();

    globalThis.fetch = (async (input) => {
      const url = String(input);

      if (url.endsWith('/v3/config/paths/list')) {
        return jsonResponse({ itemCount: 0, pageCount: 1, items: [] });
      }
      if (url.endsWith('/v3/paths/list')) {
        pathListRequests += 1;
        return new Promise<Response>((resolve) => {
          if (pathListRequests === 1) resolveFirstPaths = resolve;
          else resolveSecondPaths = resolve;
        });
      }

      return jsonResponse({ error: 'not found' }, 404);
    }) as typeof fetch;

    const firstRefresh = refreshPathsNow();
    const secondRefresh = refreshPathsNow();

    resolveSecondPaths?.(
      jsonResponse({
        itemCount: 1,
        pageCount: 1,
        items: [
          {
            name: 'camera-new',
            source: 'publisher',
            sourceError: '',
            tracks: [],
            bytesReceived: 2,
            bytesSent: 2,
            readers: [],
          },
        ],
      })
    );
    await secondRefresh;
    expect(useMediaMTXApiStore.getState().paths.data?.items[0]?.name).toBe('camera-new');

    resolveFirstPaths?.(
      jsonResponse({
        itemCount: 1,
        pageCount: 1,
        items: [
          {
            name: 'camera-old',
            source: 'publisher',
            sourceError: '',
            tracks: [],
            bytesReceived: 1,
            bytesSent: 1,
            readers: [],
          },
        ],
      })
    );
    await firstRefresh;

    expect(useMediaMTXApiStore.getState().paths.data?.items[0]?.name).toBe('camera-new');
    expect(useMediaMTXApiStore.getState().paths.error).toBeNull();
  });

  test('refresh errors preserve previously loaded Zustand data', async () => {
    const requests: string[] = [];
    resetStores();
    installApiMock(requests);
    await refreshPathsNow();

    globalThis.fetch = (async (input) => {
      const url = String(input);
      requests.push(`GET ${url}`);

      if (url.endsWith('/v3/paths/list')) {
        return new Response('server error', { status: 500 });
      }
      if (url.endsWith('/v3/config/paths/list')) {
        return jsonResponse({ itemCount: 0, pageCount: 1, items: [] });
      }

      return jsonResponse({ error: 'not found' }, 404);
    }) as typeof fetch;

    await refreshPathsNow();

    const state = useMediaMTXApiStore.getState();
    expect(state.paths.data?.items[0]?.name).toBe('camera-1');
    expect(state.paths.error?.message).toContain('HTTP 500');
    expect(state.paths.isLoading).toBe(false);
    expect(state.paths.isRefreshing).toBe(false);
  });

  test('paths retry start preserves stale error state until a successful load', () => {
    resetStores();
    const unavailable = new Error('server unavailable');

    useMediaMTXApiStore.getState().setPathsSuccess(pathsListWith('stale-camera'));
    useMediaMTXApiStore.getState().setPathsError(unavailable);
    useMediaMTXApiStore.getState().beginPathsLoad();

    const retryingResource = useMediaMTXApiStore.getState().paths;
    expect(retryingResource.data?.items[0]?.name).toBe('stale-camera');
    expect(retryingResource.error).toBe(unavailable);
    expect(retryingResource.isLoading).toBe(false);
    expect(retryingResource.isRefreshing).toBe(true);

    const retryingGate = getStreamsContentGateSnapshot();
    expect(retryingGate).toMatchObject({
      isLoading: false,
      isError: true,
      isSuccess: false,
      canRenderStreamsContent: false,
    });
    expect(retryingGate.data?.items[0]?.name).toBe('stale-camera');
    expect(retryingGate.error).toBe(unavailable);

    useMediaMTXApiStore.getState().setPathsSuccess(pathsListWith('recovered-camera'));

    const recoveredGate = getStreamsContentGateSnapshot();
    expect(recoveredGate).toMatchObject({
      isLoading: false,
      isError: false,
      isSuccess: true,
      canRenderStreamsContent: true,
    });
    expect(recoveredGate.data?.items[0]?.name).toBe('recovered-camera');
    expect(recoveredGate.error).toBeNull();
    expect(useMediaMTXApiStore.getState().paths.isRefreshing).toBe(false);
  });

  test('global config retry start preserves stale error status until a successful load', () => {
    resetStores();
    const unavailable = new Error('server unavailable');

    useMediaMTXApiStore.getState().setGlobalConfigSuccess(globalConfigData('info'));
    useMediaMTXApiStore.getState().setGlobalConfigError(unavailable);
    useMediaMTXApiStore.getState().beginGlobalConfigLoad();

    const retryingState = useMediaMTXApiStore.getState().globalConfig;
    expect(retryingState.data?.logLevel).toBe('info');
    expect(retryingState.error).toBe(unavailable);
    expect(retryingState.isLoading).toBe(false);
    expect(retryingState.isRefreshing).toBe(true);
    expect(
      getApiAvailabilityStatus({
        data: retryingState.data,
        isError: !!retryingState.error,
        isPending: retryingState.isLoading || retryingState.isRefreshing,
      })
    ).toBe('offline');

    useMediaMTXApiStore.getState().setGlobalConfigSuccess(globalConfigData('debug'));

    const recoveredState = useMediaMTXApiStore.getState().globalConfig;
    expect(recoveredState.data?.logLevel).toBe('debug');
    expect(recoveredState.error).toBeNull();
    expect(recoveredState.isLoading).toBe(false);
    expect(recoveredState.isRefreshing).toBe(false);
    expect(
      getApiAvailabilityStatus({
        data: recoveredState.data,
        isError: !!recoveredState.error,
        isPending: recoveredState.isLoading || recoveredState.isRefreshing,
      })
    ).toBe('online');
  });

  test('stream add mutation updates mutation state and refreshes loaded store data', async () => {
    const requests: string[] = [];
    resetStores();
    installApiMock(requests);
    await refreshPathsNow();

    useMediaMTXApiStore.getState().beginMutation('addStream');
    expect(useMediaMTXApiStore.getState().mutations.addStream.isPending).toBe(true);

    await runAddStreamMutation({
      pathName: 'camera-2',
      protocol: 'rtsp',
      sourceUri: 'rtsp://camera:554/stream',
    });
    useMediaMTXApiStore.getState().setMutationSuccess('addStream');

    expect(useMediaMTXApiStore.getState().mutations.addStream).toMatchObject({
      isPending: false,
      isError: false,
      isSuccess: true,
    });
    expect(requests).toContain('POST http://mediamtx.test/v3/config/paths/add/camera-2');
    expect(requests.filter((request) => request.endsWith('/v3/paths/list'))).toHaveLength(2);
  });

  test('stream add mutation refreshes mounted raw config after an initial error-only load', async () => {
    const requests: string[] = [];
    const timers = installFakeTimers();
    let rawGlobalConfigFailuresRemaining = 1;
    resetStores('http://raw-error-refresh.mediamtx.test');

    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      requests.push(`${init?.method ?? 'GET'} ${url}`);

      if (url.endsWith('/v3/config/global/get')) {
        if (rawGlobalConfigFailuresRemaining > 0) {
          rawGlobalConfigFailuresRemaining -= 1;
          return new Response('global config unavailable', { status: 500 });
        }

        return globalConfigResponse('debug');
      }
      if (url.endsWith('/v3/config/pathdefaults/get')) {
        return jsonResponse({ source: 'publisher', record: false });
      }
      if (url.endsWith('/v3/config/paths/add/camera-2')) {
        return new Response(null, { status: 204 });
      }

      return jsonResponse({ error: 'not found' }, 404);
    }) as typeof fetch;

    function RawConfigConsumer() {
      useStoreBackedRawConfig(true);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        renderer = create(createElement(RawConfigConsumer));
        await flushMicrotasks();
      });

      expect(useMediaMTXApiStore.getState().rawConfig.data).toBeUndefined();
      expect(useMediaMTXApiStore.getState().rawConfig.error?.message).toContain('HTTP 500');
      expect(requests.filter((request) => request.endsWith('/v3/config/global/get'))).toHaveLength(
        1
      );

      await runAddStreamMutation({
        pathName: 'camera-2',
        protocol: 'rtsp',
        sourceUri: 'rtsp://camera:554/stream',
      });

      const state = useMediaMTXApiStore.getState();
      expect(state.rawConfig.data?.logLevel).toBe('debug');
      expect(state.rawConfig.data?.pathDefaults).toEqual({ source: 'publisher', record: false });
      expect(state.rawConfig.error).toBeNull();
      expect(requests).toContain(
        'POST http://raw-error-refresh.mediamtx.test/v3/config/paths/add/camera-2'
      );
      expect(requests.filter((request) => request.endsWith('/v3/config/global/get'))).toHaveLength(
        2
      );
      expect(requests.filter((request) => request.endsWith('/v3/config/pathdefaults/get'))).toHaveLength(
        2
      );
    } finally {
      await act(async () => {
        renderer?.unmount();
        await flushMicrotasks();
      });
      timers.uninstall();
    }
  });

  test('kick mutation refreshes mounted paths after an initial error-only load', async () => {
    const requests: string[] = [];
    const timers = installFakeTimers();
    let pathsFailuresRemaining = 1;
    resetStores('http://paths-error-refresh.mediamtx.test');

    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      requests.push(`${init?.method ?? 'GET'} ${url}`);

      if (url.endsWith('/v3/paths/list')) {
        if (pathsFailuresRemaining > 0) {
          pathsFailuresRemaining -= 1;
          return new Response('paths unavailable', { status: 500 });
        }

        return jsonResponse({
          itemCount: 1,
          pageCount: 1,
          items: [
            {
              name: 'camera-1',
              source: 'publisher',
              sourceError: '',
              tracks: [],
              bytesReceived: 10,
              bytesSent: 20,
              readers: [],
            },
          ],
        });
      }
      if (url.endsWith('/v3/config/paths/list')) {
        return jsonResponse({
          itemCount: 1,
          pageCount: 1,
          items: [{ name: 'camera-1', source: 'rtsp://camera-1/live' }],
        });
      }
      if (url.endsWith('/v3/rtmpconns/kick/viewer-1')) {
        return new Response(null, { status: 204 });
      }

      return jsonResponse({ error: 'not found' }, 404);
    }) as typeof fetch;

    function PathsConsumer() {
      useStoreBackedPaths();
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        renderer = create(createElement(PathsConsumer));
        await flushMicrotasks();
      });

      expect(useMediaMTXApiStore.getState().paths.data).toBeUndefined();
      expect(useMediaMTXApiStore.getState().paths.error?.message).toContain('HTTP 500');
      expect(requests.filter((request) => request.endsWith('/v3/paths/list'))).toHaveLength(1);

      await runKickStreamTargetMutation({
        id: 'viewer-1',
        type: 'rtmpConn',
        endpoint: 'rtmpconns',
      });

      const state = useMediaMTXApiStore.getState();
      expect(state.paths.data?.items[0]).toMatchObject({
        name: 'camera-1',
        source: 'rtsp://camera-1/live',
        isConfigured: true,
      });
      expect(state.paths.error).toBeNull();
      expect(requests).toContain(
        'POST http://paths-error-refresh.mediamtx.test/v3/rtmpconns/kick/viewer-1'
      );
      expect(requests.filter((request) => request.endsWith('/v3/paths/list'))).toHaveLength(2);
      expect(requests.filter((request) => request.endsWith('/v3/config/paths/list'))).toHaveLength(
        2
      );
    } finally {
      await act(async () => {
        renderer?.unmount();
        await flushMicrotasks();
      });
      timers.uninstall();
    }
  });

  test('edit, delete, and kick mutations refresh affected loaded resources', async () => {
    const requests: string[] = [];
    resetStores();
    installApiMock(requests);
    await refreshPathsNow();
    await refreshGlobalConfigNow();
    await refreshRawConfigNow();

    await runEditStreamMutation({
      pathName: 'camera-1',
      sourceUri: 'rtsp://camera:554/edited',
    });
    await runDeleteStreamMutation('camera-1');
    await runKickStreamTargetMutation({ id: 'viewer-1', type: 'rtmpConn', endpoint: 'rtmpconns' });

    expect(requests).toContain('PATCH http://mediamtx.test/v3/config/paths/patch/camera-1');
    expect(requests).toContain('DELETE http://mediamtx.test/v3/config/paths/delete/camera-1');
    expect(requests).toContain('POST http://mediamtx.test/v3/rtmpconns/kick/viewer-1');
    expect(requests.filter((request) => request.endsWith('/v3/paths/list'))).toHaveLength(4);
    expect(requests.filter((request) => request.endsWith('/v3/config/global/get'))).toHaveLength(6);
    expect(requests.filter((request) => request.endsWith('/v3/config/pathdefaults/get'))).toHaveLength(
      3
    );
  });

  test('React Query implementation and dependency references are removed from source and package metadata', async () => {
    const packageJson = await Bun.file('package.json').json();
    const sourceFiles = [
      'src/App.tsx',
      'src/hooks/useMediaMTXPaths.ts',
      'src/hooks/useDashboardMetrics.ts',
      'src/hooks/useMediaMTXConfig.ts',
      'src/hooks/useAddStream.ts',
      'src/hooks/useEditStream.ts',
      'src/hooks/useDeleteStream.ts',
      'src/hooks/useKickStreamTarget.ts',
      'src/components/layout/AppHeader.tsx',
      'src/components/layout/AppSidebar.tsx',
      'src/components/streams/StreamDetailsDrawer.tsx',
      'src/components/streams/ViewerDetailsDrawer.tsx',
    ];

    expect(packageJson.dependencies['@tanstack/react-query']).toBeUndefined();
    for (const file of sourceFiles) {
      const text = await Bun.file(file).text();
      expect(text).not.toContain('@tanstack/react-query');
      expect(text).not.toContain('useQuery');
      expect(text).not.toContain('useMutation');
      expect(text).not.toContain('useQueryClient');
      expect(text).not.toContain('refetchInterval');
      expect(text).not.toContain('invalidateQueries');
    }
  });
});
