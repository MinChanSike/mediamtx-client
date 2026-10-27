export const STREAM_ASSIGNMENT_DRAG_TYPE = 'stream-assignment';

export interface StreamAssignmentDragData extends Record<string, unknown> {
  type: typeof STREAM_ASSIGNMENT_DRAG_TYPE;
  streamName: string;
}

export function createStreamAssignmentDragData(streamName: string): StreamAssignmentDragData {
  return {
    type: STREAM_ASSIGNMENT_DRAG_TYPE,
    streamName,
  };
}

export function isStreamAssignmentDragData(
  data: Record<string, unknown>
): data is StreamAssignmentDragData {
  return (
    data.type === STREAM_ASSIGNMENT_DRAG_TYPE &&
    typeof data.streamName === 'string' &&
    data.streamName.trim().length > 0
  );
}

export interface GridPlayerDragData extends Record<string, unknown> {
  type: 'grid-player';
  fromSlot: number;
  playerId: number;
}

export function createGridPlayerDragData(fromSlot: number, playerId: number): GridPlayerDragData {
  return { type: 'grid-player', fromSlot, playerId };
}

export function isGridPlayerDragData(data: Record<string, unknown>): data is GridPlayerDragData {
  return data.type === 'grid-player' &&
    Number.isInteger(data.fromSlot) && (data.fromSlot as number) >= 0 &&
    Number.isInteger(data.playerId) && (data.playerId as number) >= 0;
}

export function assignDroppedStream(
  data: Record<string, unknown>,
  slot: number,
  setGridStream: (slot: number, streamName: string) => void
): boolean {
  if (!isStreamAssignmentDragData(data)) return false;

  setGridStream(slot, data.streamName);
  return true;
}
