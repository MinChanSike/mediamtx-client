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

export function assignDroppedStream(
  data: Record<string, unknown>,
  slot: number,
  setGridStream: (slot: number, streamName: string) => void
): boolean {
  if (!isStreamAssignmentDragData(data)) return false;

  setGridStream(slot, data.streamName);
  return true;
}
