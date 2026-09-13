import useSWR from 'swr';
import { fetchRecordedFiles, type RecordedFile } from '@src/api/playbackApi';

const FILES_CACHE_PREFIX = 'mediamtx-playback-files';

export interface RecordedFilesResult {
  files: RecordedFile[];
  isLoading: boolean;
  isError: boolean;
  refresh: () => Promise<void>;
}

/**
 * Recorded video files of one stream from the playback server. Pass `null`
 * while no stream is selected to keep the hook idle.
 */
export function useRecordedFiles(
  baseUrl: string | null,
  pathName: string | null
): RecordedFilesResult {
  const { data, error, isLoading, mutate } = useSWR(
    baseUrl && pathName ? [FILES_CACHE_PREFIX, baseUrl, pathName] : null,
    ([, base, path]) => fetchRecordedFiles(base, path),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    files: data ?? [],
    isLoading,
    isError: !!error,
    refresh: async () => {
      await mutate();
    },
  };
}
