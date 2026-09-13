import type { RecordedFile } from '@src/api/playbackApi';
import { formatLocalTimeOfDay, toDayKey } from '@src/utils/playbackSyncTime';

export type RecordedFileSortDirection = 'ascending' | 'descending';

/** Local `HH:MM:SS` label for a file's absolute recording start time. */
export function formatFileStartLabel(startMs: number): string {
  return formatLocalTimeOfDay(startMs);
}

/** Local `YYYY-MM-DD` label for a file's recording date. */
export function formatFileStartDate(startMs: number): string {
  return toDayKey(startMs);
}

/** Local `YYYY-MM-DD HH:MM:SS` label for a file's recording start. */
export function formatFileRecordedAt(startMs: number): string {
  return `${formatFileStartDate(startMs)} ${formatFileStartLabel(startMs)}`;
}

/**
 * Returns a filtered and display-sorted copy without changing the canonical
 * chronological array used by playback navigation and consecutive autoplay.
 */
export function getVisibleRecordedFiles(
  files: RecordedFile[],
  query: string,
  sortDirection: RecordedFileSortDirection
): RecordedFile[] {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? files.filter((file) => {
        const date = formatFileStartDate(file.startMs);
        const time = formatFileStartLabel(file.startMs);
        return `${date} ${time} ${file.startIso}`.toLowerCase().includes(normalizedQuery);
      })
    : files;

  return [...filtered].sort((a, b) =>
    sortDirection === 'ascending' ? a.startMs - b.startMs : b.startMs - a.startMs
  );
}

/** Elapsed-position label such as `0:45` or `1:03:12` for timeline displays. */
export function formatFilePosition(positionMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(positionMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
  }
  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

/** Compact duration label such as `45s`, `4m 12s` or `1h 03m`. */
export function formatFileDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${`${minutes}`.padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${`${seconds}`.padStart(2, '0')}s`;
  return `${seconds}s`;
}
