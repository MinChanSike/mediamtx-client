import type { PathItem } from '@src/types/stream';

export type StreamRuntimeStatus = 'online' | 'offline';

export function getStreamRuntimeStatus(stream: Pick<PathItem, 'online' | 'available' | 'ready' | 'sourceState'>): StreamRuntimeStatus {
  if (typeof stream.online === 'boolean') return stream.online ? 'online' : 'offline';
  if (typeof stream.available === 'boolean') return stream.available ? 'online' : 'offline';
  if (typeof stream.ready === 'boolean') return stream.ready ? 'online' : 'offline';

  return stream.sourceState === 'ready' ? 'online' : 'offline';
}

export function isStreamOnline(stream: Pick<PathItem, 'online' | 'available' | 'ready' | 'sourceState'>): boolean {
  return getStreamRuntimeStatus(stream) === 'online';
}
