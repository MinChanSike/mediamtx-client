import { describe, expect, test } from 'bun:test';
import {
  ADD_STREAM_PLACEHOLDERS,
  ADD_STREAM_PROTOCOLS,
  addStreamSchema,
  detectAddStreamProtocol,
} from '../src/hooks/useAddStream';

describe('Add Stream protocol contract', () => {
  test('exposes exactly the requested protocol choices in drawer order', () => {
    expect(ADD_STREAM_PROTOCOLS.map((protocol) => protocol.value)).toEqual([
      'rtsp',
      'rtsps',
      'rtmp',
      'rtmps',
      'hls',
      'srt',
      'whep',
    ]);
  });

  test('uses the requested protocol-specific placeholders', () => {
    expect(ADD_STREAM_PLACEHOLDERS).toEqual({
      rtsp: 'rtsp://camera:554/stream',
      rtsps: 'rtsps://camera:554/stream',
      rtmp: 'rtmp://server:1935/stream',
      rtmps: 'rtmps://server:1935/stream',
      hls: 'http://server:8080/stream.m3u8',
      srt: 'srt://server:9000?streamid=stream',
      whep: 'whep://server:8889/stream/whep',
    });
  });

  test('detects every supported URI scheme including secure variants and WHEP', () => {
    expect(detectAddStreamProtocol('rtsp://camera:554/stream')).toBe('rtsp');
    expect(detectAddStreamProtocol('rtsps://camera:554/stream')).toBe('rtsps');
    expect(detectAddStreamProtocol('rtmp://server:1935/stream')).toBe('rtmp');
    expect(detectAddStreamProtocol('rtmps://server:1935/stream')).toBe('rtmps');
    expect(detectAddStreamProtocol('http://server:8080/stream.m3u8')).toBe('hls');
    expect(detectAddStreamProtocol('https://server:8443/stream.m3u8')).toBe('hls');
    expect(detectAddStreamProtocol('srt://server:9000?streamid=stream')).toBe('srt');
    expect(detectAddStreamProtocol('whep://server:8889/stream/whep')).toBe('whep');
    expect(detectAddStreamProtocol('udp://server:9000')).toBeNull();
  });

  test('validates supported protocol-specific source URI formats', () => {
    const validInputs = [
      { pathName: 'cam1', protocol: 'rtsp', sourceUri: 'rtsp://camera:554/stream' },
      { pathName: 'cam1', protocol: 'rtsps', sourceUri: 'rtsps://camera:554/stream' },
      { pathName: 'cam1', protocol: 'rtmp', sourceUri: 'rtmp://server:1935/stream' },
      { pathName: 'cam1', protocol: 'rtmps', sourceUri: 'rtmps://server:1935/stream' },
      { pathName: 'cam1', protocol: 'hls', sourceUri: 'http://server:8080/stream.m3u8' },
      { pathName: 'cam1', protocol: 'hls', sourceUri: 'https://server:8443/stream.m3u8' },
      { pathName: 'cam1', protocol: 'hls', sourceUri: 'https://server/stream.m3u8' },
      { pathName: 'cam1', protocol: 'srt', sourceUri: 'srt://server:9000?streamid=stream' },
      { pathName: 'cam1', protocol: 'whep', sourceUri: 'whep://server:8889/stream/whep' },
    ];

    for (const input of validInputs) {
      expect(addStreamSchema.safeParse(input).success).toBe(true);
    }
  });

  test('rejects unsupported protocols and mismatched or incomplete source URIs', () => {
    const invalidInputs = [
      { pathName: 'cam1', protocol: 'udp', sourceUri: 'udp://server:9000' },
      { pathName: 'cam1', protocol: 'rtsp', sourceUri: 'rtsps://camera:554/stream' },
      { pathName: 'cam1', protocol: 'rtmp', sourceUri: 'rtmp://server/stream' },
      { pathName: 'cam1', protocol: 'hls', sourceUri: 'http://server:8080/stream.ts' },
      { pathName: 'cam1', protocol: 'srt', sourceUri: 'srt://server:9000' },
      { pathName: 'bad name', protocol: 'whep', sourceUri: 'whep://server:8889/stream/whep' },
    ];

    for (const input of invalidInputs) {
      expect(addStreamSchema.safeParse(input).success).toBe(false);
    }
  });
});
