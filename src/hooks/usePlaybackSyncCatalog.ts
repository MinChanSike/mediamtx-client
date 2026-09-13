import useSWR from 'swr';
import { getRecordingsList } from '@src/api/recordingsApi';
import useAppStore from '@src/store/useAppStore';
import type { Recording } from '@src/schemas/recordingSchema';

const RECORDINGS_CACHE_PREFIX = 'mediamtx-playback-recordings';

export interface PlaybackSyncCatalogResult {
  recordings: Recording[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Recorded-path catalog from the Control API. SWR revalidates on page entry
 * (mount) and the page offers an explicit refresh; offline recorded streams
 * are included because they come from `/v3/recordings/list`, not `/v3/paths`.
 */
export function usePlaybackSyncCatalog(): PlaybackSyncCatalogResult {
  const serverUrl = useAppStore((s) => s.serverUrl);

  const { data, error, isLoading, mutate } = useSWR(
    [RECORDINGS_CACHE_PREFIX, serverUrl] as const,
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
    error: error ?? null,
    refresh: async () => {
      await mutate();
    },
  };
}
