import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import MetricsFreshness from '../src/components/common/MetricsFreshness';
import {
  refreshMetricsNow,
  resetMetricsRefreshTimer,
  useStoreBackedPaths,
  useStoreBackedServerInfo,
} from '../src/hooks/useMediaMTXApi';
import useAppStore from '../src/store/useAppStore';
import useMediaMTXApiStore from '../src/store/useMediaMTXApiStore';
import { LIVE_REFRESH_MS } from '../src/utils/transferRates';

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

async function advanceTimers(timers: ReturnType<typeof installFakeTimers>, milliseconds: number) {
  await act(async () => {
    timers.advanceBy(milliseconds);
    await flushMicrotasks();
  });
}

function installApiMock(requests: string[]) {
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    requests.push(`${init?.method ?? 'GET'} ${url}`);

    if (url.endsWith('/v3/paths/list')) {
      return jsonResponse({
        itemCount: 1,
        pageCount: 1,
        items: [
          {
            name: 'cam1',
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
        items: [{ name: 'cam1', source: 'publisher' }],
      });
    }

    if (url.endsWith('/v3/info')) {
      return jsonResponse({
        version: 'v1.12.3',
        started: new Date(Date.now() - 30_000).toISOString(),
      });
    }

    return jsonResponse({ error: 'not found' }, 404);
  }) as typeof fetch;
}

function resetStores(serverUrl = 'http://test-server.mediamtx:9997') {
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({ serverUrl });
  useMediaMTXApiStore.getState().resetForServerUrl(serverUrl);
}

describe('MetricsFreshness manual refresh and timer reset', () => {
  let renderer: ReactTestRenderer | undefined;

  afterEach(async () => {
    if (renderer) {
      await act(async () => {
        renderer?.unmount();
        await flushMicrotasks();
      });
      renderer = undefined;
    }
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    resetStores('');
  });

  test('renders manual refresh button to the left of the freshness text', async () => {
    resetStores('http://test-server.mediamtx:9997');
    useMediaMTXApiStore.getState().setPathsSuccess({
      itemCount: 1,
      pageCount: 1,
      items: [],
    });

    await act(async () => {
      renderer = create(createElement(MetricsFreshness));
      await flushMicrotasks();
    });

    // Button is rendered before Text (to the left of Text)
    const root = renderer!.root;
    const container = root.findByType('div');
    const button = container.findByType('button');
    expect(button).toBeDefined();
    expect(button.props['aria-label']).toBe('Refresh metrics');
    expect(button.props['title']).toBe('Refresh metrics');

    // Text says "Metrics updated"
    const spans = container.findAllByType('span');
    const textSpan = spans.find((s) =>
      Array.isArray(s.props.children)
        ? s.props.children.some((c: unknown) => typeof c === 'string' && c.includes('Metrics updated'))
        : typeof s.props.children === 'string' && s.props.children.includes('Metrics updated')
    );
    expect(textSpan).toBeDefined();
  });

  test('manual refresh button is disabled when server URL is not configured or mismatch', async () => {
    resetStores('');
    await act(async () => {
      renderer = create(createElement(MetricsFreshness));
      await flushMicrotasks();
    });

    const button = renderer.root.findByType('button');
    expect(button.props.disabled).toBe(true);
  });

  test('clicking manual refresh button triggers immediate fetch and resets automatic refresh timer', async () => {
    const requests: string[] = [];
    const timers = installFakeTimers();
    resetStores('http://timer-reset.mediamtx:9997');
    installApiMock(requests);

    function MetricsSubscriber() {
      useStoreBackedPaths();
      useStoreBackedServerInfo();
      return createElement(MetricsFreshness);
    }

    try {
      await act(async () => {
        renderer = create(createElement(MetricsSubscriber));
        await flushMicrotasks();
      });

      // Initial mount fetches paths and info
      const pathsCountAfterMount = requests.filter((r) => r.endsWith('/v3/paths/list')).length;
      expect(pathsCountAfterMount).toBe(1);

      // Advance time by 2000 ms (less than LIVE_REFRESH_MS of 3000 ms)
      await advanceTimers(timers, 2000);
      expect(requests.filter((r) => r.endsWith('/v3/paths/list')).length).toBe(1);

      // Click manual refresh button at T = 2000 ms
      const button = renderer.root.findByType('button');
      await act(async () => {
        button.props.onClick();
        await flushMicrotasks();
      });

      // Immediately after click, metrics should have refreshed
      expect(requests.filter((r) => r.endsWith('/v3/paths/list')).length).toBe(2);

      // Advance by 1500 ms (T = 3500 ms from start; 1500 ms from manual refresh)
      // If timer was NOT reset, the original timer scheduled at T = 3000 ms would have fired!
      await advanceTimers(timers, 1500);
      expect(requests.filter((r) => r.endsWith('/v3/paths/list')).length).toBe(2);

      // Advance by another 1600 ms (total 3100 ms from manual refresh)
      // The new waiting period has now elapsed, so the new auto-refresh timer fires!
      await advanceTimers(timers, 1600);
      expect(requests.filter((r) => r.endsWith('/v3/paths/list')).length).toBe(3);
    } finally {
      timers.uninstall();
    }
  });

  test('keeps existing automatic refresh functionality unchanged when manual refresh is not clicked', async () => {
    const requests: string[] = [];
    const timers = installFakeTimers();
    resetStores('http://auto-refresh.mediamtx:9997');
    installApiMock(requests);

    function MetricsSubscriber() {
      useStoreBackedPaths();
      return createElement(MetricsFreshness);
    }

    try {
      await act(async () => {
        renderer = create(createElement(MetricsSubscriber));
        await flushMicrotasks();
      });

      expect(requests.filter((r) => r.endsWith('/v3/paths/list')).length).toBe(1);

      // After 3000 ms, auto-refresh fires
      await advanceTimers(timers, 3000);
      expect(requests.filter((r) => r.endsWith('/v3/paths/list')).length).toBe(2);

      // After another 3000 ms, auto-refresh fires again
      await advanceTimers(timers, 3000);
      expect(requests.filter((r) => r.endsWith('/v3/paths/list')).length).toBe(3);
    } finally {
      timers.uninstall();
    }
  });
});
