import { describe, expect, test } from 'bun:test';

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
});
