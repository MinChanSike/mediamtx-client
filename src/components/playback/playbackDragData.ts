export const PLAYBACK_ASSIGNMENT_DRAG_TYPE = 'playback-assignment';

export interface PlaybackAssignmentDragData extends Record<string, unknown> {
  type: typeof PLAYBACK_ASSIGNMENT_DRAG_TYPE;
  recordingName: string;
}

export function createPlaybackAssignmentDragData(
  recordingName: string
): PlaybackAssignmentDragData {
  return {
    type: PLAYBACK_ASSIGNMENT_DRAG_TYPE,
    recordingName,
  };
}

export function isPlaybackAssignmentDragData(
  data: Record<string, unknown>
): data is PlaybackAssignmentDragData {
  return (
    data.type === PLAYBACK_ASSIGNMENT_DRAG_TYPE &&
    typeof data.recordingName === 'string' &&
    data.recordingName.trim().length > 0
  );
}

export function assignDroppedRecording(
  data: Record<string, unknown>,
  slot: number,
  setSlot: (slot: number, path: string | null) => void
): boolean {
  if (!isPlaybackAssignmentDragData(data)) return false;

  setSlot(slot, data.recordingName);
  return true;
}
