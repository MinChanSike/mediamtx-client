import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  RecordedPlaybackSyncController,
  type PlaybackSyncGridSnapshot,
} from '@src/playbackSync/recordedPlaybackSyncController';
import usePlaybackSyncStore from '@src/store/usePlaybackSyncStore';
import type { NormalizedSpan } from '@src/utils/playbackSyncIntervals';
import { getDayRangeMs } from '@src/utils/playbackSyncTime';

const POSITION_SYNC_INTERVAL_MS = 250;

export interface RecordedPlaybackSyncBinding {
  controller: RecordedPlaybackSyncController;
  snapshot: PlaybackSyncGridSnapshot;
}

/**
 * Binds the recorded playback controller to React:
 *
 * - feeds the resolved playback endpoint and per-path interval data,
 * - resets the shared clock when the selected day changes,
 * - pauses and resets the transport when the grid becomes empty,
 * - mirrors isPlaying/shared timestamp into the playback store for the UI,
 * - disposes the controller (releasing all media) on unmount/route change.
 */
export function useRecordedPlaybackSync(
  spansByPath: Record<string, NormalizedSpan[] | undefined>,
  endpoint: string | null
): RecordedPlaybackSyncBinding {
  const controllerRef = useRef<RecordedPlaybackSyncController | null>(null);
  // StrictMode double-invokes effects in development; dispose() runs on the
  // simulated unmount, so a disposed controller is replaced instead of
  // leaving the page with a dead one.
  if (!controllerRef.current || controllerRef.current.isDisposed()) {
    controllerRef.current = new RecordedPlaybackSyncController({
      initialPositionMs: usePlaybackSyncStore.getState().sharedTimestampMs,
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

  // An empty grid freezes the shared clock and resets the transport to its
  // defaults. Derived from assigned paths, not tile lifecycles, so replacing
  // a stream never pauses the grid mid-play.
  const hasAssignedPaths = Object.keys(spansByPath).length > 0;
  useEffect(() => {
    if (hasAssignedPaths) return;

    const dayRange = getDayRangeMs(usePlaybackSyncStore.getState().selectedDay);
    controller.pause();
    if (dayRange) controller.seekTo(dayRange.startMs);

    const store = usePlaybackSyncStore.getState();
    store.setIsPlaying(false);
    store.setRate(1);
    if (dayRange) store.setSharedTimestamp(dayRange.startMs);
  }, [controller, hasAssignedPaths]);

  // Day changes pause the grid and reset the clock to local midnight.
  const selectedDay = usePlaybackSyncStore((s) => s.selectedDay);
  useEffect(() => {
    const dayRange = getDayRangeMs(selectedDay);
    if (!dayRange) return;

    controller.pause();
    controller.seekTo(dayRange.startMs);

    const store = usePlaybackSyncStore.getState();
    store.setIsPlaying(false);
    store.setSharedTimestamp(dayRange.startMs);
  }, [controller, selectedDay]);

  // Playback rate and the selected audio slot are store-driven.
  const rate = usePlaybackSyncStore((s) => s.rate);
  useEffect(() => {
    controller.setRate(rate);
  }, [controller, rate]);

  const audioSlot = usePlaybackSyncStore((s) => s.audioSlot);
  useEffect(() => {
    controller.setAudioSlot(audioSlot);
  }, [controller, audioSlot]);

  // Mirror controller transport state into the store for the UI.
  useEffect(() => {
    const sync = () => {
      const store = usePlaybackSyncStore.getState();
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
