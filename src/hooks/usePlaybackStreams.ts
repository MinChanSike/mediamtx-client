import useSWR from 'swr';
import { getRecordingsList } from '@src/api/recordingsApi';
import useAppStore from '@src/store/useAppStore';
import type { Recording } from '@src/schemas/recordingSchema';

const STREAMS_CACHE_PREFIX = 'mediamtx-playback-streams';

export interface PlaybackStreamsResult {
  recordings: Recording[];
  isLoading: boolean;
  isError: boolean;
  refresh: () => Promise<void>;
}

/**
 * Recorded streams for the file-playback page, from the Control API
 * recordings list. Only names and segment starts are needed here; playable
 * per-file durations come from the playback server via `useRecordedFiles`.
 */
export function usePlaybackStreams(): PlaybackStreamsResult {
  const serverUrl = useAppStore((s) => s.serverUrl);

  const { data, error, isLoading, mutate } = useSWR(
    [STREAMS_CACHE_PREFIX, serverUrl] as const,
    ([, server]) => getRecordingsList(server),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    recordings: data?.items ?? [],
    isLoading,
    isError: !!error,
    refresh: async () => {
      await mutate();
    },
  };
}
