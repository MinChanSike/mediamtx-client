import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  buildPlaybackGetUrl,
  buildPlaybackListUrl,
  derivePlaybackBaseUrl,
  extractPlaybackPort,
  fetchPlaybackSpans,
} from '../src/api/playbackSyncApi';

const originalFetch = globalThis.fetch;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('playback port and endpoint derivation', () => {
  test('extracts trailing ports from listener addresses', () => {
    expect(extractPlaybackPort(':9996')).toBe('9996');
    expect(extractPlaybackPort('0.0.0.0:9996')).toBe('9996');
    expect(extractPlaybackPort('127.0.0.1:9996')).toBe('9996');
    expect(extractPlaybackPort('[::]:9996')).toBe('9996');
    expect(extractPlaybackPort(undefined)).toBe('9996');
    expect(extractPlaybackPort(undefined, '8888')).toBe('8888');
    expect(extractPlaybackPort('127.0.0.1:9996/path')).toBe('9996');
    expect(extractPlaybackPort('localhost')).toBe('9996');
  });

  test('derives the default endpoint from the API hostname, port, and encryption', () => {
    expect(
      derivePlaybackBaseUrl('https://media.example.test:9997', {
        playback: true,
        playbackAddress: ':9996',
        playbackEncryption: false,
      })
    ).toBe('http://media.example.test:9996');

    expect(
      derivePlaybackBaseUrl('http://10.0.0.4:9997', {
        playbackAddress: '0.0.0.0:7888',
        playbackEncryption: true,
      })
    ).toBe('https://10.0.0.4:7888');

    expect(derivePlaybackBaseUrl('http://10.0.0.4:9997', {})).toBe('http://10.0.0.4:9996');
  });

  test('returns null for invalid API server URLs', () => {
    expect(derivePlaybackBaseUrl('not a url', {})).toBeNull();
    expect(derivePlaybackBaseUrl('', {})).toBeNull();
  });
});

describe('playback URL construction', () => {
  test('builds /list URLs with RFC3339 bounds', () => {
    const url = buildPlaybackListUrl(
      'http://localhost:9996',
      'camera/main',
      Date.UTC(2026, 0, 2, 9, 0, 0),
      Date.UTC(2026, 0, 2, 18, 30, 0)
    );

    expect(url).toBe(
      'http://localhost:9996/list?path=camera%2Fmain&start=2026-01-02T09%3A00%3A00.000Z&end=2026-01-02T18%3A30%3A00.000Z'
    );
  });

  test('builds bounded /get URLs with fmp4 format and float seconds', () => {
    const url = buildPlaybackGetUrl(
      'http://localhost:9996',
      'camera-main',
      Date.UTC(2026, 0, 2, 9, 15, 0),
      300
    );

    expect(url).toBe(
      'http://localhost:9996/get?path=camera-main&start=2026-01-02T09%3A15%3A00.000Z&duration=300.000&format=fmp4'
    );
  });

  test('encodes nested path names and preserves base paths', () => {
    const url = buildPlaybackGetUrl('http://host:9996/base/', 'a/b c', 0, 12.5);
    expect(url).toContain('http://host:9996/base/get?');
    // URLSearchParams form-encoding uses '+' for spaces, which MediaMTX's
    // Go query parser decodes identically to '%20'.
    expect(url).toContain('path=a%2Fb+c');
    expect(url).toContain('duration=12.500');
  });
});

describe('fetchPlaybackSpans', () => {
  test('parses interval entries and keeps returned boundaries', async () => {
    globalThis.fetch = (async () =>
      jsonResponse([
        {
          start: '2026-01-02T09:00:00Z',
          duration: 600,
          url: 'http://localhost:9996/get?path=x',
        },
        {
          start: '2026-01-02T10:00:00Z',
          duration: 0.5,
          url: 'http://localhost:9996/get?path=y',
        },
      ])) as typeof fetch;

    const spans = await fetchPlaybackSpans(
      'http://localhost:9996',
      'x',
      0,
      1,
      undefined
    );

    expect(spans).toEqual([
      { start: '2026-01-02T09:00:00Z', duration: 600, url: 'http://localhost:9996/get?path=x' },
      { start: '2026-01-02T10:00:00Z', duration: 0.5, url: 'http://localhost:9996/get?path=y' },
    ]);
  });

  test('treats 404 as an empty interval list', async () => {
    globalThis.fetch = (async () => jsonResponse({ error: 'no segments found' }, 404)) as typeof fetch;

    const spans = await fetchPlaybackSpans('http://localhost:9996', 'x', 0, 1);
    expect(spans).toEqual([]);
  });

  test('surfaces HTTP errors and rejects malformed payloads', async () => {
    globalThis.fetch = (async () => jsonResponse({ error: 'boom' }, 500)) as typeof fetch;
    expect(fetchPlaybackSpans('http://localhost:9996', 'x', 0, 1)).rejects.toThrow('HTTP 500');

    globalThis.fetch = (async () => jsonResponse({ not: 'an array' })) as typeof fetch;
    expect(fetchPlaybackSpans('http://localhost:9996', 'x', 0, 1)).rejects.toThrow(
      'unexpected /list payload'
    );

    globalThis.fetch = (async () => jsonResponse([{ start: 'nope', duration: -1, url: '' }])) as typeof fetch;
    expect(fetchPlaybackSpans('http://localhost:9996', 'x', 0, 1)).rejects.toThrow();
  });

  test('sends plain GET requests with an AbortSignal and no content-type header', async () => {
    let observed: RequestInit | undefined;
    let observedUrl = '';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      observedUrl = String(input);
      observed = init;
      return jsonResponse([]);
    }) as typeof fetch;

    const controller = new AbortController();
    await fetchPlaybackSpans('http://localhost:9996', 'x', 0, 1, controller.signal);

    expect(observedUrl.startsWith('http://localhost:9996/list?')).toBe(true);
    expect(observed?.method).toBe('GET');
    expect(observed?.signal).toBe(controller.signal);
    expect(observed?.headers).toBeUndefined();
  });
});

describe('playback /list URL usage contract', () => {
  test('shared SpanInterval consumers use the numeric helpers, not raw span URLs', async () => {
    const source = await Bun.file('src/api/playbackSyncApi.ts').text();
    expect(source).toContain("params.set('format', 'fmp4')");
    expect(source).toContain("params.set('path', pathName)");
    expect(source).toContain("response.status === 404");
  });
});
