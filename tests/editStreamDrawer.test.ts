import { describe, expect, test } from 'bun:test';
import {
  getEditStreamInitialProtocol,
  validateEditStreamSource,
} from '../src/components/streams/EditStreamDrawer';
import {
  ADD_STREAM_PLACEHOLDERS,
  ADD_STREAM_PROTOCOLS,
  detectAddStreamProtocol,
} from '../src/hooks/useAddStream';

describe('Edit Stream drawer Add Stream parity', () => {
  test('uses the Add Stream protocol list, order, detection, and placeholders', async () => {
    const source = await Bun.file('src/components/streams/EditStreamDrawer.tsx').text();

    expect(source).toContain('ADD_STREAM_PROTOCOLS');
    expect(source).toContain('ADD_STREAM_PLACEHOLDERS[protocol]');
    expect(source).toContain('detectAddStreamProtocol');
    expect(source).not.toContain('const PROTOCOLS');
    expect(source).not.toContain("value: 'udp'");
    expect(source).not.toContain("value: 'file'");
    expect(source).not.toContain("value: 'ffmpeg'");
    expect(source).not.toContain("value: 'unknown'");

    expect(ADD_STREAM_PROTOCOLS.map((protocol) => protocol.value)).toEqual([
      'rtsp',
      'rtsps',
      'rtmp',
      'rtmps',
      'hls',
      'srt',
      'whep',
    ]);
    expect(getEditStreamInitialProtocol('rtsps://camera:554/stream')).toBe('rtsps');
    expect(getEditStreamInitialProtocol('rtmps://server:1935/stream')).toBe('rtmps');
    expect(getEditStreamInitialProtocol('whep://server:8889/stream/whep')).toBe('whep');
    expect(getEditStreamInitialProtocol('publisher')).toBe('rtsp');
    expect(detectAddStreamProtocol('udp://server:9000')).toBeNull();
    expect(ADD_STREAM_PLACEHOLDERS.whep).toBe('whep://server:8889/stream/whep');
  });

  test('keeps Add Stream field order and inline actions while stream name remains read-only', async () => {
    const source = await Bun.file('src/components/streams/EditStreamDrawer.tsx').text();

    expect(source.indexOf('label="Input Protocol"')).toBeLessThan(source.indexOf('label="Stream Name (read-only)"'));
    expect(source.indexOf('label="Stream Name (read-only)"')).toBeLessThan(source.indexOf('label="Source URI"'));
    expect(source).toContain('<Input id="edit-path-name" className="w-full" readOnly value={stream.name} />');
    expect(source).toContain('<div className="flex justify-end gap-3">');
    expect(source).not.toContain('<DrawerFooter>');
  });

  test('patches only the selected stream source URI', async () => {
    const editHookSource = await Bun.file('src/hooks/useEditStream.ts').text();
    const integrationSource = await Bun.file('src/hooks/useMediaMTXApi.ts').text();
    const drawerSource = await Bun.file('src/components/streams/EditStreamDrawer.tsx').text();

    expect(editHookSource).toContain("useStoreMutation<EditStreamInput>('editStream', runEditStreamMutation)");
    expect(integrationSource).toContain('patchPath(input.pathName, input.sourceUri)');
    expect(drawerSource).toContain('{ pathName: stream.name, sourceUri: sourceUri.trim() }');
    expect(drawerSource).not.toContain('pathName: sourceUri');
  });

  test('validates edited source URI with Add Stream rules and secure variants', () => {
    expect(validateEditStreamSource('rtsp', 'rtsp://camera:554/stream')).toBeNull();
    expect(validateEditStreamSource('rtsps', 'rtsps://camera:554/stream')).toBeNull();
    expect(validateEditStreamSource('rtmp', 'rtmp://server:1935/stream')).toBeNull();
    expect(validateEditStreamSource('rtmps', 'rtmps://server:1935/stream')).toBeNull();
    expect(validateEditStreamSource('hls', 'https://server/stream.m3u8')).toBeNull();
    expect(validateEditStreamSource('srt', 'srt://server:9000?streamid=stream')).toBeNull();
    expect(validateEditStreamSource('whep', 'whep://server:8889/stream/whep')).toBeNull();

    expect(validateEditStreamSource('rtsp', '')).toBe('Source URI is required');
    expect(validateEditStreamSource('rtsp', 'rtsps://camera:554/stream')).toBe(
      'Source URI must match RTSP format, for example rtsp://camera:554/stream'
    );
    expect(validateEditStreamSource('hls', 'http://server/stream.ts')).toBe(
      'Source URI must match HLS format, for example http://server:8080/stream.m3u8'
    );
  });
});
