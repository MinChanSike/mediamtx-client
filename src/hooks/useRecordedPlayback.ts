import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  RecordedPlaybackController,
  type PlaybackGridSnapshot,
} from '@src/playback/recordedPlaybackController';
import usePlaybackStore from '@src/store/usePlaybackStore';
import type { NormalizedSpan } from '@src/utils/playbackIntervals';
import { getDayRangeMs } from '@src/utils/playbackTime';

const POSITION_SYNC_INTERVAL_MS = 250;

export interface RecordedPlaybackBinding {
  controller: RecordedPlaybackController;
  snapshot: PlaybackGridSnapshot;
}

/**
 * Binds the recorded playback controller to React:
 *
 * - feeds the resolved playback endpoint and per-path interval data,
 * - resets the shared clock when the selected day changes,
 * - mirrors isPlaying/shared timestamp into the playback store for the UI,
 * - disposes the controller (releasing all media) on unmount/route change.
 */
export function useRecordedPlayback(
  spansByPath: Record<string, NormalizedSpan[] | undefined>,
  endpoint: string | null
): RecordedPlaybackBinding {
  const controllerRef = useRef<RecordedPlaybackController | null>(null);
  // StrictMode double-invokes effects in development; dispose() runs on the
  // simulated unmount, so a disposed controller is replaced instead of
  // leaving the page with a dead one.
  if (!controllerRef.current || controllerRef.current.isDisposed()) {
    controllerRef.current = new RecordedPlaybackController({
      initialPositionMs: usePlaybackStore.getState().sharedTimestampMs,
    });
  }
  const controller = controllerRef.current;

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  // Release media resources on unmount or route navigation.
  useEffect(() => () => controller.dispose(), [controller]);

  // Follow the resolved playback server endpoint.
  useEffect(() => {
    controller.setEndpoint(endpoint);
  }, [controller, endpoint]);

  // Feed interval availability; refreshed spans never restart healthy tiles.
  useEffect(() => {
    for (const [path, spans] of Object.entries(spansByPath)) {
      controller.setSpans(path, spans ?? null);
    }
  }, [controller, spansByPath]);

  // Day changes pause the grid and reset the clock to local midnight.
  const selectedDay = usePlaybackStore((s) => s.selectedDay);
  useEffect(() => {
    const dayRange = getDayRangeMs(selectedDay);
    if (!dayRange) return;

    controller.pause();
    controller.seekTo(dayRange.startMs);

    const store = usePlaybackStore.getState();
    store.setIsPlaying(false);
    store.setSharedTimestamp(dayRange.startMs);
  }, [controller, selectedDay]);

  // Playback rate and the selected audio slot are store-driven.
  const rate = usePlaybackStore((s) => s.rate);
  useEffect(() => {
    controller.setRate(rate);
  }, [controller, rate]);

  const audioSlot = usePlaybackStore((s) => s.audioSlot);
  useEffect(() => {
    controller.setAudioSlot(audioSlot);
  }, [controller, audioSlot]);

  // Mirror controller transport state into the store for the UI.
  useEffect(() => {
    const sync = () => {
      const store = usePlaybackStore.getState();
      const playing = controller.isPlaying();
      if (store.isPlaying !== playing) store.setIsPlaying(playing);

      const positionMs = controller.getPositionMs();
      if (store.sharedTimestampMs !== positionMs) store.setSharedTimestamp(positionMs);
    };

    sync();
    const unsubscribe = controller.subscribe(sync);
    const timer = setInterval(sync, POSITION_SYNC_INTERVAL_MS);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [controller]);

  return useMemo(() => ({ controller, snapshot }), [controller, snapshot]);
}
