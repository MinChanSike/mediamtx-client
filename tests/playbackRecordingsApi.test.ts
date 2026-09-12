import { afterEach, describe, expect, test } from 'bun:test';
import { getRecording, getRecordingsList } from '../src/api/recordingsApi';
import { recordingListSchema } from '../src/schemas/recordingSchema';

const originalFetch = globalThis.fetch;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function recording(name: string, starts: string[]) {
  return { name, segments: starts.map((start) => ({ start })) };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('recording pagination', () => {
  test('fetches catalog pages sequentially until pageCount is exhausted', async () => {
    const requestedUrls: string[] = [];
    const pages = [
      {
        itemCount: 3,
        pageCount: 2,
        items: [recording('cam-a', ['2026-01-02T09:00:00Z']), recording('cam-b', [])],
      },
      {
        itemCount: 3,
        pageCount: 2,
        items: [recording('cam-c', ['2026-01-02T10:00:00Z'])],
      },
    ];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      const page = Number(new URL(url).searchParams.get('page') ?? '0');
      return jsonResponse(pages[page]);
    }) as typeof fetch;

    const result = await getRecordingsList('http://localhost:9997');

    expect(requestedUrls).toEqual([
      'http://localhost:9997/v3/recordings/list?page=0&itemsPerPage=100',
      'http://localhost:9997/v3/recordings/list?page=1&itemsPerPage=100',
    ]);
    expect(result.items.map((item) => item.name)).toEqual(['cam-a', 'cam-b', 'cam-c']);
    expect(result.itemCount).toBe(3);
  });

  test('rejects the catalog when the page count shifts mid-pagination', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const page = Number(new URL(String(input)).searchParams.get('page') ?? '0');
      return jsonResponse({
        itemCount: 4,
        pageCount: page === 0 ? 2 : 3,
        items: [recording('cam-a', [])],
      });
    }) as typeof fetch;

    expect(getRecordingsList('http://localhost:9997')).rejects.toThrow(
      'Recording list changed during pagination'
    );
  });

  test('fetches a single recording detail by encoded name', async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return jsonResponse(recording('nested/path', ['2026-01-02T09:00:00Z']));
    }) as typeof fetch;

    const detail = await getRecording('nested/path', 'http://localhost:9997');
    expect(detail.name).toBe('nested/path');
    expect(requestedUrls).toEqual([
      'http://localhost:9997/v3/recordings/get/nested%2Fpath',
    ]);
  });
});

describe('recording schema validation', () => {
  test('accepts Control API recording lists with passthrough fields', () => {
    const parsed = recordingListSchema.parse({
      itemCount: 1,
      pageCount: 1,
      items: [{ name: 'cam', segments: [{ start: '2026-01-02T09:00:00Z', extra: 1 }] }],
    });
    expect(parsed.items[0].segments[0]).toMatchObject({ start: '2026-01-02T09:00:00Z' });
  });

  test('rejects malformed recording lists', () => {
    expect(() => recordingListSchema.parse({ itemCount: 1, pageCount: 1, items: 'nope' })).toThrow();
    expect(() =>
      recordingListSchema.parse({
        itemCount: 1,
        pageCount: 1,
        items: [{ name: 7, segments: [] }],
      })
    ).toThrow();
    expect(() =>
      recordingListSchema.parse({ itemCount: 1, pageCount: 1, items: [{ name: 'x', segments: null }] })
    ).toThrow();
  });
});
