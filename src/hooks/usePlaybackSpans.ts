import { useRef } from 'react';
import useSWR from 'swr';
import { fetchPlaybackSpans } from '@src/api/playbackApi';
import type { NormalizedSpan } from '@src/utils/playbackIntervals';
import { normalizeSpans } from '@src/utils/playbackIntervals';
import { getDayRangeMs, todayDayKey } from '@src/utils/playbackTime';

const SPANS_CACHE_PREFIX = 'mediamtx-playback-spans';

/** Interval availability refresh cadence for the current day, per the plan. */
export const TODAY_SPANS_REFRESH_MS = 30_000;

export interface PlaybackSpanIdentity {
  endpoint: string;
  path: string;
  day: string;
}

export type SpansKey = readonly [string, string, string, string];

/**
 * Response identity guard: responses are rejected when the server, playback
 * endpoint, path, or selected day changed while the request was in flight.
 */
export function isSameSpanIdentity(
  captured: PlaybackSpanIdentity,
  current: PlaybackSpanIdentity
): boolean {
  return (
    captured.endpoint === current.endpoint &&
    captured.path === current.path &&
    captured.day === current.day
  );
}

export function buildSpansKey(prefix: string, identity: PlaybackSpanIdentity): SpansKey {
  return [prefix, identity.endpoint, identity.path, identity.day];
}

export interface SlotSpansResult {
  /** Normalized intervals; undefined while loading or when nothing is assigned. */
  spans: NormalizedSpan[] | undefined;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Fetches the playable intervals (`/list`) for one playback slot's path and
 * the selected day. Today's availability refreshes every 30 seconds while the
 * page is visible without touching the active video elements (the controller
 * only consumes refreshed spans to recover gap tiles).
 */
export function useSlotSpans(
  path: string | null,
  dayKey: string,
  endpoint: string | null
): SlotSpansResult {
  const identity: PlaybackSpanIdentity | null =
    path && endpoint ? { endpoint, path, day: dayKey } : null;

  // The fetcher reads the latest identity when a response arrives, so a
  // response for a superseded server/endpoint/path/day never surfaces.
  const identityRef = useRef<PlaybackSpanIdentity | null>(identity);
  identityRef.current = identity;

  const key = identity ? buildSpansKey(SPANS_CACHE_PREFIX, identity) : null;

  const { data, error, isLoading } = useSWR(
    key,
    async (fetchKey: SpansKey) => {
      const [, fetchEndpoint, fetchPath, fetchDay] = fetchKey;
      const dayRange = getDayRangeMs(fetchDay);
      if (!dayRange) return [];

      const spans = await fetchPlaybackSpans(
        fetchEndpoint,
        fetchPath,
        dayRange.startMs,
        dayRange.endMs
      );

      const current = identityRef.current;
      if (
        !current ||
        !isSameSpanIdentity(current, {
          endpoint: fetchEndpoint,
          path: fetchPath,
          day: fetchDay,
        })
      ) {
        throw new Error('Discarded stale playback interval response.');
      }

      return normalizeSpans(spans);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      refreshInterval: dayKey === todayDayKey() ? TODAY_SPANS_REFRESH_MS : 0,
    }
  );

  return {
    spans: identity ? data : undefined,
    error: error ?? null,
    isLoading: !!identity && isLoading,
    isError: !!error,
  };
}
