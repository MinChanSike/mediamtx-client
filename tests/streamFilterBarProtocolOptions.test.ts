import { describe, expect, test } from 'bun:test';
import { getDisplayProtocol } from '../src/utils/streamDisplay';
import { PROTOCOL_OPTIONS } from '../src/components/streams/StreamFilterBar';

// The dropdown's protocol-specific values (excluding the 'all' sentinel) must mirror every
// value `getDisplayProtocol` can return, so any display protocol can be isolated by the filter.
const SPECIFIC_PROTOCOL_OPTIONS = PROTOCOL_OPTIONS.filter((opt) => opt.value !== 'all').map(
  (opt) => opt.value,
);

// Every output shape `getDisplayProtocol` can produce for a real MediaMTX path source.
function reachableDisplayProtocols(): string[] {
  const reachable = new Set<string>();
  // detectInputProtocol branches keyed off the source URL string
  reachable.add(getDisplayProtocol({ source: 'rtsp://x', sourceInfo: null } as any));
  reachable.add(getDisplayProtocol({ source: 'rtmp://x', sourceInfo: null } as any));
  reachable.add(getDisplayProtocol({ source: 'srt://x', sourceInfo: null } as any));
  reachable.add(getDisplayProtocol({ source: 'udp://x', sourceInfo: null } as any));
  reachable.add(getDisplayProtocol({ source: 'http://x/index.m3u8', sourceInfo: null } as any));
  reachable.add(getDisplayProtocol({ source: '/path/to/file', sourceInfo: null } as any));
  reachable.add(getDisplayProtocol({ source: 'ffmpeg:foo', sourceInfo: null } as any));
  reachable.add(getDisplayProtocol(null as any));
  // SOURCE_TYPE_PROTOCOL_PREFIXES branch: real WebRTC publisher/reader, source null, type set
  reachable.add(
    getDisplayProtocol({ source: null, sourceInfo: { type: 'webRTCSource' } } as any),
  );
  reachable.add(
    getDisplayProtocol({ source: null, sourceInfo: { type: 'webRTCSession' } } as any),
  );
  return [...reachable];
}

describe('Stream protocol filter options', () => {
  test('every value getDisplayProtocol can return has a matching dropdown option', () => {
    const reachable = reachableDisplayProtocols();
    const missing = reachable.filter((v) => !SPECIFIC_PROTOCOL_OPTIONS.includes(v));
    expect(missing).toEqual([]);
    expect(SPECIFIC_PROTOCOL_OPTIONS).toEqual(expect.arrayContaining(reachable));
  });

  test('getDisplayProtocol returns webrtc for real MediaMTX WebRTC sources', () => {
    expect(
      getDisplayProtocol({ source: null, sourceInfo: { type: 'webRTCSource' } } as any),
    ).toBe('webrtc');
    expect(
      getDisplayProtocol({ source: null, sourceInfo: { type: 'webRTCSession' } } as any),
    ).toBe('webrtc');
  });
});
