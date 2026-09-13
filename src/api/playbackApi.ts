import { ApiError } from '@src/api/client';
import { playbackSpanSchema } from '@src/schemas/recordingSchema';
import { toRfc3339 } from '@src/utils/playbackSyncTime';

/**
 * One recorded video file: a single MediaMTX recording segment addressable on
 * the playback server by its absolute start timestamp and duration.
 */
export interface RecordedFile {
  /** RFC3339 start timestamp as returned by the playback server. */
  startIso: string;
  /** Epoch milliseconds matching `startIso`. */
  startMs: number;
  /** Playable length in milliseconds. */
  durationMs: number;
}

const LIST_WINDOW_END_MS = 4102444800000; // 2100-01-01, effectively "all files"

function joinPlaybackUrl(baseUrl: string, pathname: string, params: URLSearchParams): string {
  const base = new URL(baseUrl);
  base.pathname = `${base.pathname.replace(/\/+$/, '')}${pathname}`;
  base.search = '';
  return `${base.origin}${base.pathname}?${params.toString()}`;
}

/** Normalizes and sorts playback-server span entries into ascending files. */
export function sortRecordedFiles(spans: Array<{ start: string; duration: number }>): RecordedFile[] {
  return spans
    .map((span) => {
      const startMs = Date.parse(span.start);
      return {
        startIso: span.start,
        startMs,
        durationMs: Math.round(span.duration * 1000),
      };
    })
    .filter((file) => !Number.isNaN(file.startMs))
    .sort((a, b) => a.startMs - b.startMs);
}

/**
 * Fetches every recorded file of one path from the playback server `/list`
 * endpoint. A 404 answer means the path has no segments and maps to an empty
 * list rather than an error.
 */
export async function fetchRecordedFiles(
  baseUrl: string,
  pathName: string,
  signal?: AbortSignal
): Promise<RecordedFile[]> {
  const params = new URLSearchParams();
  params.set('path', pathName);
  params.set('start', toRfc3339(0));
  params.set('end', toRfc3339(LIST_WINDOW_END_MS));

  const base = new URL(baseUrl);
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/list`;
  base.search = '';
  const response = await fetch(`${base.origin}${base.pathname}?${params.toString()}`, {
    method: 'GET',
    signal,
  });

  if (response.status === 404) return [];
  if (!response.ok) throw new ApiError(response.status, response.statusText);

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Playback server returned an unexpected /list payload.');
  }

  return sortRecordedFiles(payload.map((entry) => playbackSpanSchema.parse(entry)));
}

/**
 * Maximum media requested from `/get` per window. The playback server sends
 * `Accept-Ranges: none`, so one huge progressive response cannot be seeked and
 * stalls once playback catches up with the download head; bounded windows keep
 * every request small and anchored at the playhead.
 */
export const MAX_FILE_WINDOW_MS = 300_000;

/** Opens the next window when the playhead gets this close to the window end. */
export const WINDOW_ROLLOVER_MARGIN_MS = 5_000;

function startTimestampForFileOffset(file: RecordedFile, offsetMs: number): string {
  return offsetMs === 0 ? file.startIso : toRfc3339(file.startMs + offsetMs);
}

/** Streamable fMP4 source URL for one recorded file. */
export function buildFileSourceUrl(baseUrl: string, pathName: string, file: RecordedFile): string {
  return buildFileWindowSourceUrl(baseUrl, pathName, file, 0, file.durationMs);
}

/**
 * Streamable fMP4 source for a bounded window of one recorded file. The first
 * window keeps the exact MediaMTX /list timestamp so microsecond segment starts
 * continue to match the playback server.
 */
export function buildFileWindowSourceUrl(
  baseUrl: string,
  pathName: string,
  file: RecordedFile,
  offsetMs: number,
  durationMs: number
): string {
  const params = new URLSearchParams();
  params.set('path', pathName);
  params.set('start', startTimestampForFileOffset(file, offsetMs));
  params.set('duration', (durationMs / 1000).toFixed(3));
  params.set('format', 'fmp4');
  return joinPlaybackUrl(baseUrl, '/get', params);
}

/**
 * Streamable fMP4 source for a bounded window of a recorded path, starting at
 * an absolute recording timestamp. Seeks outside the loaded window must be
 * served by opening a new window at the target instead of range requests.
 */
export function buildWindowSourceUrl(
  baseUrl: string,
  pathName: string,
  absoluteStartMs: number,
  durationMs: number
): string {
  const params = new URLSearchParams();
  params.set('path', pathName);
  params.set('start', toRfc3339(absoluteStartMs));
  params.set('duration', (durationMs / 1000).toFixed(3));
  params.set('format', 'fmp4');
  return joinPlaybackUrl(baseUrl, '/get', params);
}

/**
 * Download URL for the original recording file. Without `format=fmp4` the
 * playback server serves the recorded MP4 as-is, which browsers can save.
 */
export function buildFileDownloadUrl(baseUrl: string, pathName: string, file: RecordedFile): string {
  const params = new URLSearchParams();
  params.set('path', pathName);
  params.set('start', file.startIso);
  params.set('duration', (file.durationMs / 1000).toFixed(3));
  return joinPlaybackUrl(baseUrl, '/get', params);
}

/** Stable identity of a file inside a path, used for list keys and selection. */
export function recordedFileKey(file: RecordedFile): string {
  return file.startIso;
}

/** Returns the file at `index + delta` while staying inside the list. */
export function findAdjacentFile(
  files: RecordedFile[],
  key: string | null,
  delta: 1 | -1
): RecordedFile | null {
  if (files.length === 0) return null;
  const index = key === null ? -1 : files.findIndex((file) => recordedFileKey(file) === key);
  if (index === -1) return delta === 1 ? files[0] : null;
  const nextIndex = index + delta;
  return nextIndex >= 0 && nextIndex < files.length ? files[nextIndex] : null;
}
