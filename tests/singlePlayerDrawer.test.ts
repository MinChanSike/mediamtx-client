import { describe, expect, test } from 'bun:test';
import { getSinglePlayerMetrics } from '../src/components/streams/SinglePlayerDrawer';
import type { PathItem } from '../src/types/stream';

const stream: PathItem = {
  name: 'camera-main',
  source: 'rtsp://camera:554/stream',
  sourceInfo: { type: 'rtspSource' },
  sourceState: 'ready',
  sourceError: '',
  tracks: [
    { id: 0, type: 'H264' },
    { id: 1, type: 'Opus' },
  ],
  bytesReceived: 100,
  bytesSent: 200,
  inboundBytes: 1024,
  outboundBytes: 2048,
  readers: [
    { id: 'reader-1', type: 'webrtcSession', state: 'read' },
    { id: 'reader-2', type: 'rtmpConn', state: 'read' },
  ],
};

describe('Single Player drawer polish', () => {
  test('uses the stream name as drawer title without the generic monitoring title', async () => {
    const source = await Bun.file('src/components/streams/SinglePlayerDrawer.tsx').text();

    expect(source).toContain("{drawerStream?.name ?? 'Stream'}");
    expect(source).not.toContain('Active Stream Monitoring');
  });

  test('renders the shared playback URL component without owning inline URL list logic', async () => {
    const source = await Bun.file('src/components/streams/SinglePlayerDrawer.tsx').text();

    expect(source).toContain("import PlaybackUrls from '@src/components/streams/PlaybackUrls'");
    expect(source).toContain('<PlaybackUrls streamName={drawerStream.name} />');
    expect(source).not.toContain('type PlaybackUrlType');
    expect(source).not.toContain('interface PlaybackUrl');
    expect(source).not.toContain('const getUrls');
    expect(source).not.toContain('copyToClipboard(playbackUrl.value, playbackUrl.type)');
  });

  test('builds compact stream metadata below the player from selected stream data', () => {
    expect(getSinglePlayerMetrics(stream)).toEqual([
      { label: 'Protocol', value: 'RTSP' },
      { label: 'Track Count', value: '2' },
      { label: 'Bytes In/Out', value: '1,024 / 2,048' },
      { label: 'Total Readers', value: '2' },
    ]);
  });

  test('falls byte metrics back to bytesReceived and bytesSent and handles empty readers', () => {
    expect(
      getSinglePlayerMetrics({
        ...stream,
        source: 'https://server/stream.m3u8',
        inboundBytes: undefined,
        outboundBytes: undefined,
        tracks: [],
        readers: [],
      })
    ).toEqual([
      { label: 'Protocol', value: 'HLS' },
      { label: 'Track Count', value: '0' },
      { label: 'Bytes In/Out', value: '100 / 200' },
      { label: 'Total Readers', value: '0' },
    ]);
  });
});
