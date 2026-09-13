export function isStreamRecordingEnabled(...sources: unknown[]): boolean {
  return sources.some((source) => {
    if (!source || typeof source !== 'object') return false;

    const recordable = source as Record<string, unknown>;
    if (recordable.record === true || recordable.recording === true) return true;

    const state = recordable.recordingState ?? recordable.recordingStatus;
    return typeof state === 'string' && ['recording', 'active', 'enabled'].includes(state.toLowerCase());
  });
}
