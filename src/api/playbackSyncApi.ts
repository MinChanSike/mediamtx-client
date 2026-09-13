import { ApiError } from '@src/api/client';
import { playbackSpanSchema, type PlaybackSpan } from '@src/schemas/recordingSchema';
import { toRfc3339 } from '@src/utils/playbackSyncTime';

/**
 * Helpers for the MediaMTX playback HTTP server, which is separate from the
 * JSON Control API. Unlike the Control API helper, these requests are plain
 * GETs without a Content-Type header, and they accept AbortSignals so SWR
 * can cancel superseded interval fetches.
 */

export const DEFAULT_PLAYBACK_PORT = '9996';

export interface PlaybackSyncEndpointConfig {
  playback?: boolean;
  playbackAddress?: string;
  playbackEncryption?: boolean;
}

/**
 * Extracts the port from a MediaMTX listener address such as `:9996`,
 * `0.0.0.0:9996` or `127.0.0.1:9996`. Addresses that contain a path or no
 * trailing port fall back to the provided default.
 */
export function extractPlaybackPort(
  playbackAddress: string | undefined,
  fallback = DEFAULT_PLAYBACK_PORT
): string {
  if (!playbackAddress) return fallback;

  const portMatch = /:(\d+)$/.exec(playbackAddress.trim());
  return portMatch ? portMatch[1] : fallback;
}

/**
 * Derives the default playback base URL from the API server URL hostname,
 * the configured `playbackAddress` port, and `playbackEncryption`. The
 * result is the URL the browser should use to reach `/list` and `/get`.
 */
export function derivePlaybackBaseUrl(
  serverUrl: string,
  config: PlaybackSyncEndpointConfig
): string | null {
  let api: URL;
  try {
    api = new URL(serverUrl);
  } catch {
    return null;
  }
  if (!api.hostname) return null;

  const protocol = config.playbackEncryption ? 'https' : 'http';
  const port = extractPlaybackPort(config.playbackAddress);
  return `${protocol}://${api.hostname}:${port}`;
}

function joinPlaybackUrl(baseUrl: string, pathname: string, params: URLSearchParams): string {
  const base = new URL(baseUrl);
  base.pathname = `${base.pathname.replace(/\/+$/, '')}${pathname}`;
  base.search = '';
  return `${base.origin}${base.pathname}?${params.toString()}`;
}

/**
 * Builds the playback server `/list` URL for one recorded path and time
 * window. `startMs`/`endMs` are epoch milliseconds encoded as RFC3339.
 */
export function buildPlaybackListUrl(
  baseUrl: string,
  pathName: string,
  startMs: number,
  endMs: number
): string {
  const params = new URLSearchParams();
  params.set('path', pathName);
  params.set('start', toRfc3339(startMs));
  params.set('end', toRfc3339(endMs));
  return joinPlaybackUrl(baseUrl, '/list', params);
}

/**
 * Builds the playback server `/get` URL for a bounded media request starting
 * at an absolute recording timestamp. `durationSec` is a float number of
 * seconds and `format=fmp4` is the only format the first implementation
 * targets.
 */
export function buildPlaybackGetUrl(
  baseUrl: string,
  pathName: string,
  startMs: number,
  durationSec: number
): string {
  const params = new URLSearchParams();
  params.set('path', pathName);
  params.set('start', toRfc3339(startMs));
  params.set('duration', durationSec.toFixed(3));
  params.set('format', 'fmp4');
  return joinPlaybackUrl(baseUrl, '/get', params);
}

/**
 * Fetches the playable intervals for one recorded path in the given window.
 * The playback server answers `404` when no segments exist in the requested
 * range, which is reported as an empty list rather than an error.
 */
export async function fetchPlaybackSpans(
  baseUrl: string,
  pathName: string,
  startMs: number,
  endMs: number,
  signal?: AbortSignal
): Promise<PlaybackSpan[]> {
  const response = await fetch(buildPlaybackListUrl(baseUrl, pathName, startMs, endMs), {
    method: 'GET',
    signal,
  });

  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Playback server returned an unexpected /list payload.');
  }

  return payload.map((entry) => playbackSpanSchema.parse(entry));
}
