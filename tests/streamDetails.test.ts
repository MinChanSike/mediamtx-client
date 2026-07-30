import { afterEach, describe, expect, test } from 'bun:test';
import { getViewerDetail } from '../src/api/pathsApi';
import useAppStore from '../src/store/useAppStore';
import {
  DISPLAYED_STREAM_DETAIL_KEYS,
  VIEWER_TABLE_COLUMNS,
  getAdditionalStreamDetails,
  getFetchedViewerPrimitiveDetails,
  getPrimitiveDetails,
  getSourceIdentityDetails,
  getSourcePrimitiveDetails,
  getViewerTableRows,
  isRecord,
  resolveLatestDetailsStream,
} from '../src/utils/streamDetails';
import {
  getViewerDetailTargetFromReader,
  getViewerDetailTargetFromInfo,
} from '../src/utils/streamDisplay';
import type { PathItem } from '../src/types/stream';

const originalFetch = globalThis.fetch;
const obsoleteReaderCountLabel = ['<DetailSection label="', 'View', 'er Count">'].join('');

const baseStream: PathItem = {
  name: 'camera-1',
  source: 'rtsp://camera/stream',
  sourceState: 'ready',
  sourceError: '',
  tracks: [],
  bytesReceived: 128,
  bytesSent: 256,
  readers: [],
};

function formatExpectedLocalTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  useAppStore.setState({ serverUrl: 'http://localhost:9997' });
});

describe('Stream details primitive extraction', () => {
  test('keeps primitive fields and excludes nested objects and arrays', () => {
    expect(
      getPrimitiveDetails(
        {
          stringValue: 'ready',
          numberValue: 3,
          booleanValue: false,
          objectValue: { id: 'nested' },
          arrayValue: ['nested'],
          nullValue: null,
        },
        [],
      ),
    ).toEqual([
      { key: 'stringValue', value: 'ready' },
      { key: 'numberValue', value: 3 },
      { key: 'booleanValue', value: false },
    ]);
  });

  test('keeps only the requested additional detail fields', () => {
    const stream: PathItem = {
      ...baseStream,
      ready: true,
      bytesReceived: 1024,
      readers: [
        {
          id: 'reader-1',
          type: 'webrtcSession',
          state: 'read',
        },
      ],
      serverDetail: 'extra',
    };

    expect(getAdditionalStreamDetails(stream, null)).toEqual([{ key: 'Ready', value: true }]);
    expect(DISPLAYED_STREAM_DETAIL_KEYS).toContain('bytesReceived');
    expect(DISPLAYED_STREAM_DETAIL_KEYS).toContain('readers');
  });

  test('adds requested primitive path detail fields when stream fields do not provide them', () => {
    const stream: PathItem = {
      ...baseStream,
    };

    expect(
      getAdditionalStreamDetails(stream, {
        configName: 'runtime-config',
        ready: false,
        readyTime: '2026-07-28T05:00:00Z',
        available: true,
        availableTime: '2026-07-28T05:01:00Z',
        online: true,
        onlineTime: '2026-07-28T05:02:00Z',
        inboundFramesInError: 2,
        ignoredPrimitive: 'not-rendered',
        source: { type: 'rtspSource' },
        readers: [{ id: 'reader-1' }],
      }),
    ).toEqual([
      { key: 'Config Name', value: 'runtime-config' },
      { key: 'Ready', value: false },
      { key: 'Read Time', value: formatExpectedLocalTime('2026-07-28T05:00:00Z') },
      { key: 'Available', value: true },
      { key: 'Available Time', value: formatExpectedLocalTime('2026-07-28T05:01:00Z') },
      { key: 'Online', value: true },
      { key: 'Online Time', value: formatExpectedLocalTime('2026-07-28T05:02:00Z') },
      { key: 'Inbound Frame Errors', value: 2 },
    ]);
  });

  test('falls back to readTime when readyTime is absent', () => {
    expect(
      getAdditionalStreamDetails(baseStream, {
        readTime: '2026-07-28T05:03:00Z',
      }),
    ).toEqual([
      { key: 'Read Time', value: formatExpectedLocalTime('2026-07-28T05:03:00Z') },
    ]);
  });

  test('prefers readyTime from fetched path detail over stream readTime', () => {
    expect(
      getAdditionalStreamDetails(
        {
          ...baseStream,
          readTime: 'old',
        },
        {
          readyTime: 'current',
        },
      ),
    ).toEqual([{ key: 'Read Time', value: 'current' }]);
  });

  test('keeps invalid time values unchanged', () => {
    expect(
      getAdditionalStreamDetails(baseStream, {
        availableTime: 'not-a-date',
        onlineTime: false,
      }),
    ).toEqual([
      { key: 'Available Time', value: 'not-a-date' },
      { key: 'Online Time', value: false },
    ]);
  });

  test('treats arrays and null as unsupported detail records', () => {
    expect(isRecord([{ key: 'value' }])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord({ key: 'value' })).toBe(true);
  });

  test('builds source tab identity and primitive source detail rows', () => {
    const stream: PathItem = {
      ...baseStream,
      sourceInfo: {
        id: 'source-1',
        type: 'rtspSource',
        remoteAddr: '192.0.2.1:554',
        nested: { ignored: true },
      },
    };

    expect(getSourceIdentityDetails(stream, null)).toEqual([
      { key: 'ID', value: 'source-1' },
      { key: 'Type', value: 'rtspSource' },
    ]);
    expect(getSourcePrimitiveDetails(stream)).toEqual([
      { key: 'remoteAddr', value: '192.0.2.1:554' },
    ]);
  });

  test('falls source identity back to the stream name and path detail source type', () => {
    expect(
      getSourceIdentityDetails(
        {
          ...baseStream,
          sourceInfo: null,
        },
        {
          source: {
            sourceType: 'fallbackSource',
          },
        },
      ),
    ).toEqual([
      { key: 'ID', value: 'camera-1' },
      { key: 'Type', value: 'fallbackSource' },
    ]);
  });

  test('extracts only primitive fetched reader detail rows without raw nested dumps', () => {
    expect(
      getFetchedViewerPrimitiveDetails({
        id: 'viewer-1',
        type: 'rtmpConn',
        state: 'read',
        bytesReceived: 100,
        nested: { ignored: true },
      }),
    ).toEqual([
      { key: 'state', value: 'read' },
      { key: 'bytesReceived', value: 100 },
    ]);
  });
});

describe('Stream details freshness and reader table model', () => {
  test('resolves an open details stream from the latest refreshed stream item by name', () => {
    const clickedStream: PathItem = {
      ...baseStream,
      bytesReceived: 128,
      bytesSent: 256,
      readers: [],
    };
    const latestMatchingStream: PathItem = {
      ...baseStream,
      bytesReceived: 4096,
      bytesSent: 8192,
      readers: [
        {
          id: 'fresh-reader',
          type: 'webrtcSession',
          state: 'read',
        },
      ],
    };

    expect(resolveLatestDetailsStream(clickedStream, [latestMatchingStream])).toBe(
      latestMatchingStream,
    );
    expect(resolveLatestDetailsStream(null, [latestMatchingStream])).toBeNull();
  });

  test('falls back to the clicked stream when the refreshed list does not contain it', () => {
    const clickedStream: PathItem = {
      ...baseStream,
      name: 'selected',
    };
    const unrelatedStream: PathItem = {
      ...baseStream,
      name: 'other',
    };

    expect(resolveLatestDetailsStream(clickedStream, [unrelatedStream])).toBe(clickedStream);
  });

  test('pins the reader table columns required by the drawer', () => {
    expect(VIEWER_TABLE_COLUMNS).toEqual(['ID', 'Type']);
  });

  test('builds compact reader table rows with conditional kick and detail targets', () => {
    const rows = getViewerTableRows([
      {
        id: 'viewer-1',
        type: 'webrtcSession',
        state: 'read',
        remoteAddr: '192.0.2.10:5000',
        protocol: 'webrtc',
        created: 'not-a-date',
        packetsReceived: 12,
        nested: { ignored: true },
      },
      {
        id: 'viewer-2',
        type: 'unsupportedReader',
        state: '',
        ip: '192.0.2.11',
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: 'viewer-1',
      identity: 'viewer-1',
      type: 'webrtcSession',
      details: [{ key: 'packetsReceived', value: 12 }],
      kickTarget: {
        id: 'viewer-1',
        type: 'webrtcSession',
        endpoint: 'webrtcsessions',
      },
      detailTarget: {
        id: 'viewer-1',
        type: 'webrtcSession',
        endpoint: 'webrtcsessions',
      },
    });
    expect(rows[1]).toMatchObject({
      key: 'viewer-2',
      identity: 'viewer-2',
      type: 'unsupportedReader',
      details: [],
      kickTarget: null,
      detailTarget: null,
    });
  });

  test('exposes only the clicked reader target as the per-row kick mutation payload', () => {
    const rows = getViewerTableRows([
      {
        id: 'viewer-1',
        type: 'webrtcSession',
        state: 'read',
      },
      {
        id: 'viewer-2',
        type: 'rtmpConn',
        state: 'read',
      },
    ]);

    expect(rows[1].kickTarget).toEqual({
      id: 'viewer-2',
      type: 'rtmpConn',
      endpoint: 'rtmpconns',
    });
    expect(rows[1].kickTarget).not.toEqual([rows[0].kickTarget, rows[1].kickTarget]);
  });

  test('maps supported reader types to type-specific detail get endpoints', () => {
    expect(
      [
        ['hlsSession', 'hlssessions'],
        ['rtspConn', 'rtspconns'],
        ['rtspsConn', 'rtspsconns'],
        ['rtspSession', 'rtspsessions'],
        ['rtspsSession', 'rtspssessions'],
        ['rtmpConn', 'rtmpconns'],
        ['rtmpsConn', 'rtmpsconns'],
        ['srtConn', 'srtconns'],
        ['webrtcSession', 'webrtcsessions'],
        ['moqSession', 'moqsessions'],
      ].map(([type, endpoint]) => [
        getViewerDetailTargetFromInfo({ id: 'viewer-1', type }),
        endpoint,
      ]),
    ).toEqual([
      [{ id: 'viewer-1', type: 'hlsSession', endpoint: 'hlssessions' }, 'hlssessions'],
      [{ id: 'viewer-1', type: 'rtspConn', endpoint: 'rtspconns' }, 'rtspconns'],
      [{ id: 'viewer-1', type: 'rtspsConn', endpoint: 'rtspsconns' }, 'rtspsconns'],
      [{ id: 'viewer-1', type: 'rtspSession', endpoint: 'rtspsessions' }, 'rtspsessions'],
      [{ id: 'viewer-1', type: 'rtspsSession', endpoint: 'rtspssessions' }, 'rtspssessions'],
      [{ id: 'viewer-1', type: 'rtmpConn', endpoint: 'rtmpconns' }, 'rtmpconns'],
      [{ id: 'viewer-1', type: 'rtmpsConn', endpoint: 'rtmpsconns' }, 'rtmpsconns'],
      [{ id: 'viewer-1', type: 'srtConn', endpoint: 'srtconns' }, 'srtconns'],
      [{ id: 'viewer-1', type: 'webrtcSession', endpoint: 'webrtcsessions' }, 'webrtcsessions'],
      [{ id: 'viewer-1', type: 'moqSession', endpoint: 'moqsessions' }, 'moqsessions'],
    ]);
  });

  test('does not create reader detail targets for unsupported or incomplete readers', () => {
    expect(getViewerDetailTargetFromReader({ id: 'viewer-1', type: 'unsupported', state: '' })).toBeNull();
    expect(getViewerDetailTargetFromInfo({ id: 'viewer-1' })).toBeNull();
    expect(getViewerDetailTargetFromInfo({ type: 'rtmpConn' })).toBeNull();
  });

  test('fetches reader details through the mapped get endpoint with an encoded ID', async () => {
    const requestedUrls: string[] = [];
    useAppStore.setState({ serverUrl: 'http://mediamtx.test' });
    globalThis.fetch = (async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ id: 'viewer/1', state: 'read' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await expect(
      getViewerDetail({ id: 'viewer/1', type: 'rtmpConn', endpoint: 'rtmpconns' }),
    ).resolves.toEqual({ id: 'viewer/1', state: 'read' });
    expect(requestedUrls).toEqual(['http://mediamtx.test/v3/rtmpconns/get/viewer%2F1']);
  });
});

describe('Stream details playback URLs tab', () => {
  test('renders the shared playback URL component for the selected stream name', async () => {
    const source = await Bun.file('src/components/streams/StreamDetailsDrawer.tsx').text();

    expect(source).toContain("import PlaybackUrls from '@src/components/streams/PlaybackUrls'");
    expect(source).toContain("{selectedTab === 'playbackUrls' && <PlaybackUrls streamName={stream.name} />}");
    expect(source).not.toContain("{selectedTab === 'playbackUrls' && <></>}");
  });
});

describe('Stream details reader count placement', () => {
  test('omits reader count from the summary section', async () => {
    const source = await Bun.file('src/components/streams/StreamDetailsDrawer.tsx').text();

    expect(source).not.toContain(obsoleteReaderCountLabel);
  });

  test('shows an outline badge in the Readers tab only when readers are present', async () => {
    const source = await Bun.file('src/components/streams/StreamDetailsDrawer.tsx').text();

    expect(source).toContain("Badge,");
    expect(source).toContain('const viewerCount = stream?.readers.length ?? 0;');
    expect(source).toContain(
      '{viewerCount > 0 && <Badge appearance="outline">{viewerCount}</Badge>}',
    );
  });
});
