export const PLAYBACK_SYNC_ASSIGNMENT_DRAG_TYPE = 'playback-sync-assignment';

export interface PlaybackSyncAssignmentDragData extends Record<string, unknown> {
  type: typeof PLAYBACK_SYNC_ASSIGNMENT_DRAG_TYPE;
  recordingName: string;
}

export function createPlaybackSyncAssignmentDragData(
  recordingName: string
): PlaybackSyncAssignmentDragData {
  return {
    type: PLAYBACK_SYNC_ASSIGNMENT_DRAG_TYPE,
    recordingName,
  };
}

export function isPlaybackSyncAssignmentDragData(
  data: Record<string, unknown>
): data is PlaybackSyncAssignmentDragData {
  return (
    data.type === PLAYBACK_SYNC_ASSIGNMENT_DRAG_TYPE &&
    typeof data.recordingName === 'string' &&
    data.recordingName.trim().length > 0
  );
}

export function assignDroppedSyncRecording(
  data: Record<string, unknown>,
  slot: number,
  setSlot: (slot: number, path: string | null) => void
): boolean {
  if (!isPlaybackSyncAssignmentDragData(data)) return false;

  setSlot(slot, data.recordingName);
  return true;
}
