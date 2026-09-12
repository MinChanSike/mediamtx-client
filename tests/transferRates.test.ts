import { afterEach, describe, expect, test } from 'bun:test';
import { formatByteRate } from '../src/utils/formatters';
import {
  compareTransferRates,
  normalizeCounter,
  sampleTransferRates,
  sumTransferRates,
  UNAVAILABLE_RATE,
} from '../src/utils/transferRates';
import useMediaMTXApiStore from '../src/store/useMediaMTXApiStore';
import { calculateDashboardMetrics } from '../src/store/useDashboardMetricsStore';
import { getPathsList } from '../src/api/pathsApi';
import type { PathItem } from '../src/types/stream';

const path = (overrides: Partial<PathItem> = {}): PathItem => ({
  name: 'camera',
  source: 'publisher',
  sourceError: '',
  tracks: [],
  readers: [],
  inboundBytes: 1000,
  outboundBytes: 2000,
  online: true,
  ...overrides,
});
const list = (...items: PathItem[]) => ({
  items,
  itemCount: items.length,
  pageCount: 1,
});
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useMediaMTXApiStore.getState().expireRates();
});

describe('transfer sampling', () => {
  test('uses measured elapsed time and shares the baseline independently of renders', () => {
    const first = sampleTransferRates([path()], {}, 1000);
    expect(first.rates.camera).toEqual(UNAVAILABLE_RATE);
    const next = sampleTransferRates(
      [path({ inboundBytes: 7000, outboundBytes: 2000 })],
      first.samples,
      5000
    );
    expect(next.rates.camera).toEqual({
      inboundBytesPerSecond: 1500,
      outboundBytesPerSecond: 0,
    });
    expect(first.samples.camera.inbound).toBe(1000);
  });

  test('normalizes modern, legacy and total aliases without turning missing values into zero', () => {
    expect(normalizeCounter(path({ inboundBytes: 0, bytesReceived: 50 }), 'inbound')).toBe(0);
    expect(normalizeCounter(path({ inboundBytes: undefined, bytesReceived: 50 }), 'inbound')).toBe(
      50
    );
    expect(
      normalizeCounter(
        path({ inboundBytes: NaN, bytesReceived: -1, totalBytesReceived: 70 }),
        'inbound'
      )
    ).toBe(70);
    expect(normalizeCounter(path({ inboundBytes: undefined }), 'inbound')).toBeNull();
    expect(
      normalizeCounter(path({ outboundBytes: undefined, totalBytesSent: 99 }), 'outbound')
    ).toBe(99);
  });

  test.each([
    ['decreased counter', { inboundBytes: 999 }, 4000],
    ['changed publisher', { sourceInfo: { id: 'new' } }, 4000],
    ['changed lifecycle', { onlineTime: 'new' }, 4000],
    ['offline transition', { online: false }, 4000],
    ['stale gap', {}, 7001],
    ['nonpositive elapsed', {}, 1000],
  ] as const)('rebaselines after %s', (_label, change, at) => {
    const first = sampleTransferRates([path()], {}, 1000);
    expect(sampleTransferRates([path(change)], first.samples, at).rates.camera).toEqual(
      UNAVAILABLE_RATE
    );
  });

  test('handles missing directions, fractional rates and path disappearance/reappearance', () => {
    const first = sampleTransferRates([path({ outboundBytes: undefined })], {}, 0);
    const next = sampleTransferRates([path({ inboundBytes: 1001 })], first.samples, 4000);
    expect(next.rates.camera).toEqual({
      inboundBytesPerSecond: 0.25,
      outboundBytesPerSecond: null,
    });
    const removed = sampleTransferRates([], next.samples, 5000);
    expect(Object.keys(removed.samples)).toHaveLength(0);
    expect(sampleTransferRates([path()], removed.samples, 6000).rates.camera).toEqual(
      UNAVAILABLE_RATE
    );
  });

  test('accepts path names that are Object prototype keys', () => {
    const first = sampleTransferRates([path({ name: '__proto__' })], {}, 0);
    expect(first.rates.__proto__).toEqual(UNAVAILABLE_RATE);
    expect(
      sampleTransferRates([path({ name: '__proto__' })], first.samples, 3000).rates.__proto__
        .inboundBytesPerSecond
    ).toBe(0);
  });

  test('aggregates per-path rates and marks incomplete directions partial', () => {
    const first = sampleTransferRates([path()], {}, 0);
    const paths = [path({ inboundBytes: 4000 }), path({ name: 'new' })];
    const second = sampleTransferRates(paths, first.samples, 3000);
    const metrics = calculateDashboardMetrics({
      paths: list(...paths),
      rates: second.rates,
      ratesStatus: 'fresh',
    });
    expect(metrics.inboundBytesPerSecond).toBe(1000);
    expect(metrics.ingressPartial).toBe(true);
    expect(metrics.cards.find((card) => card.label === 'Ingress')?.description).toContain(
      'Partial'
    );
    expect(sumTransferRates([], {}).inbound).toEqual({
      value: 0,
      partial: false,
    });
    expect(
      calculateDashboardMetrics({ paths: list(), ratesStatus: 'stale' }).inboundBytesPerSecond
    ).toBeNull();
  });

  test('clears rates and baselines on error, expiry and server changes while retaining raw data on failure', () => {
    const store = useMediaMTXApiStore.getState;
    store().resetForServerUrl('server-a');
    store().setPathsSuccess(list(path()), 0);
    store().setPathsSuccess(list(path({ inboundBytes: 4000 })), 3000);
    expect(store().transferRates.camera.inboundBytesPerSecond).toBe(1000);
    store().setPathsError(new Error('offline'));
    expect(store().transferRates).toEqual({});
    expect(store().paths.data?.items[0].inboundBytes).toBe(4000);
    store().setPathsSuccess(list(path()), 4000);
    expect(store().transferRates.camera).toEqual(UNAVAILABLE_RATE);
    store().expireRates();
    expect(store().ratesStatus).toBe('stale');
    expect(store().transferSamples).toEqual({});
    store().resetForServerUrl('server-b');
    expect(store().ratesStatus).toBe('unavailable');
    store().setPathsSuccess(list(path()), 5000);
    expect(store().transferRates.camera).toEqual(UNAVAILABLE_RATE);
  });
});

describe('rate presentation', () => {
  test.each([
    [null, '\u2014'],
    [NaN, '\u2014'],
    [-1, '\u2014'],
    [0, '0 B/s'],
    [0.25, '0.3 B/s'],
    [1024, '1.0 KiB/s'],
    [1048576, '1.0 MiB/s'],
  ] as const)('formats %s as %s', (value, expected) =>
    expect(formatByteRate(value)).toBe(expected)
  );
  test('sorts numerically with unavailable values last in both directions', () => {
    const values = [null, 2000, 100, 0];
    expect([...values].sort((a, b) => compareTransferRates(a, b))).toEqual([0, 100, 2000, null]);
    expect([...values].sort((a, b) => compareTransferRates(a, b, true))).toEqual([
      2000,
      100,
      0,
      null,
    ]);
  });
});

describe('complete path snapshots', () => {
  test('fetches all runtime and configuration pages before returning', async () => {
    const requests: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = new URL(String(input));
      requests.push(url.pathname + url.search);
      const second = url.searchParams.get('page') === '1';
      const item = url.pathname.includes('/config/')
        ? { name: second ? 'b' : 'a', source: 'rtsp://camera/live' }
        : path({ name: second ? 'b' : 'a' });
      return Response.json({ itemCount: 2, pageCount: 2, items: [item] });
    }) as typeof fetch;
    const result = await getPathsList('http://test');
    expect(result.items.map((item) => item.name)).toEqual(['a', 'b']);
    expect(result.items.every((item) => item.isConfigured)).toBe(true);
    expect(requests).toContain('/v3/paths/list?page=1');
    expect(requests).toContain('/v3/config/paths/list?page=1');
  });
  test('rejects a failed later page instead of returning a partial list', async () => {
    globalThis.fetch = (async (input) => {
      const url = new URL(String(input));
      if (url.search) return new Response('', { status: 500 });
      return Response.json({ itemCount: 2, pageCount: 2, items: [path()] });
    }) as typeof fetch;
    await expect(getPathsList('http://test')).rejects.toThrow('HTTP 500');
  });
});
