import { describe, expect, test } from 'bun:test';
import { buildPlaybackUrls, extractPort } from '../src/components/streams/PlaybackUrls';

describe('shared playback URL generation', () => {
  test('builds all playback URL formats from configured listener ports and server URL parts', () => {
    expect(
      buildPlaybackUrls(
        'camera-main',
        {
          webrtcAddress: ':8899',
          hlsAddress: '0.0.0.0:8898',
          rtspAddress: '127.0.0.1:8555',
          rtmpAddress: ':1936',
          srtAddress: ':8891',
        },
        'https://media.example.test:9997',
      ),
    ).toEqual([
      {
        type: 'webrtc',
        label: 'WebRTC WHEP',
        description: 'Low latency browser playback',
        value: 'https://media.example.test:8899/camera-main/whep',
      },
      {
        type: 'hls',
        label: 'HLS',
        description: 'High compatibility playback',
        value: 'https://media.example.test:8898/camera-main/index.m3u8',
      },
      {
        type: 'rtsp',
        label: 'RTSP',
        description: 'Media player and NVR playback',
        value: 'rtsp://media.example.test:8555/camera-main',
      },
      {
        type: 'rtmp',
        label: 'RTMP',
        description: 'RTMP client playback',
        value: 'rtmp://media.example.test:1936/camera-main',
      },
      {
        type: 'srt',
        label: 'SRT',
        description: 'SRT read stream ID playback',
        value: 'srt://media.example.test:8891?streamid=read:camera-main',
      },
    ]);
  });

  test('keeps existing fallback ports and localhost/http parsing fallback', () => {
    expect(buildPlaybackUrls('fallback-stream', null, 'not a url').map(({ value }) => value)).toEqual([
      'http://localhost:8889/fallback-stream/whep',
      'http://localhost:8888/fallback-stream/index.m3u8',
      'rtsp://localhost:8554/fallback-stream',
      'rtmp://localhost:1935/fallback-stream',
      'srt://localhost:8890?streamid=read:fallback-stream',
    ]);
  });

  test('extracts only trailing address ports', () => {
    expect(extractPort(':8554', 'fallback')).toBe('8554');
    expect(extractPort('127.0.0.1:1935', 'fallback')).toBe('1935');
    expect(extractPort('127.0.0.1:1935/path', 'fallback')).toBe('fallback');
    expect(extractPort(undefined, 'fallback')).toBe('fallback');
  });
});

describe('shared playback URL UI', () => {
  test('owns labels, copy controls, read-only inputs, icons, and compact list styles', async () => {
    const source = await Bun.file('src/components/streams/PlaybackUrls.tsx').text();

    for (const label of ['WebRTC WHEP', 'HLS', 'RTSP', 'RTMP', 'SRT']) {
      expect(source).toContain(`label: '${label}'`);
    }

    for (const description of [
      'Low latency browser playback',
      'High compatibility playback',
      'Media player and NVR playback',
      'RTMP client playback',
      'SRT read stream ID playback',
    ]) {
      expect(source).toContain(`description: '${description}'`);
    }

    expect(source).toContain('Copy24Regular');
    expect(source).toContain('Checkmark24Regular');
    expect(source).toContain('copyToClipboard(playbackUrl.value, playbackUrl.type)');
    expect(source).toContain('<Input readOnly value={playbackUrl.value}');
    expect(source).toContain('gap: tokens.spacingVerticalS');
    expect(source).toContain('urlRow');
    expect(source).toContain('marginTop: tokens.spacingVerticalXXS');
  });
});
