import type { PlaybackSpan } from '@src/schemas/recordingSchema';
import { parseRfc3339 } from '@src/utils/playbackSyncTime';

/**
 * Interval math for recorded playback.
 *
 * The playback server `/list` endpoint returns intervals with exact
 * boundaries; MediaMTX only concatenates compatible adjacent fMP4 segments,
 * so those boundaries must be preserved as the source of truth for media
 * requests. Union ranges are computed separately, only for timeline display
 * and gap navigation.
 */

export interface SpanInterval {
  startMs: number;
  endMs: number;
}

export interface NormalizedSpan extends SpanInterval {
  span: PlaybackSpan;
}

/** Merged coverage range used for union math. */
export type TimeRange = SpanInterval;

/** A coverage hole inside an inspected window. */
export type TimeGap = SpanInterval;

function spanEndMs(span: PlaybackSpan): number | null {
  const startMs = parseRfc3339(span.start);
  if (startMs === null) return null;
  return startMs + span.duration * 1000;
}

/**
 * Converts playback spans to numeric intervals sorted by start time.
 * Boundaries are preserved verbatim; overlapping or adjacent spans are NOT
 * merged because each span maps to a distinct playable `/get` request.
 */
export function normalizeSpans(spans: PlaybackSpan[]): NormalizedSpan[] {
  const normalized: NormalizedSpan[] = [];
  for (const span of spans) {
    const startMs = parseRfc3339(span.start);
    const endMs = spanEndMs(span);
    if (startMs === null || endMs === null || endMs <= startMs) continue;
    normalized.push({ startMs, endMs, span });
  }
  normalized.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  return normalized;
}

/**
 * Computes the merged union of coverage ranges, used for timeline display
 * and gap navigation (never for media requests).
 */
export function unionRanges(intervals: SpanInterval[]): TimeRange[] {
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const union: TimeRange[] = [];

  for (const interval of sorted) {
    const last = union[union.length - 1];
    if (last && interval.startMs <= last.endMs) {
      if (interval.endMs > last.endMs) {
        last.endMs = interval.endMs;
      }
    } else {
      union.push({ startMs: interval.startMs, endMs: interval.endMs });
    }
  }

  return union;
}

/**
 * Returns the gaps (complement of coverage) inside [fromMs, toMs). Used to
 * render visible gaps in availability lanes.
 */
export function gapsInRange(coverage: SpanInterval[], fromMs: number, toMs: number): TimeGap[] {
  const union = unionRanges(coverage);
  const gaps: TimeGap[] = [];
  let cursor = fromMs;

  for (const range of union) {
    if (range.endMs <= cursor) continue;
    if (range.startMs >= toMs) break;

    const clippedStart = Math.max(range.startMs, cursor);
    if (clippedStart > cursor) {
      gaps.push({ startMs: cursor, endMs: clippedStart });
    }
    cursor = Math.max(cursor, range.endMs);
    if (cursor >= toMs) break;
  }

  if (cursor < toMs) {
    gaps.push({ startMs: cursor, endMs: toMs });
  }

  return gaps;
}

/**
 * Clips coverage to [fromMs, toMs) for display. Boundaries of spans that
 * extend past the window are trimmed without merging the spans themselves.
 */
export function clipSpansToRange(
  spans: NormalizedSpan[],
  fromMs: number,
  toMs: number
): Array<SpanInterval & { source: NormalizedSpan }> {
  const clipped: Array<SpanInterval & { source: NormalizedSpan }> = [];
  for (const span of spans) {
    if (span.endMs <= fromMs || span.startMs >= toMs) continue;
    clipped.push({
      startMs: Math.max(span.startMs, fromMs),
      endMs: Math.min(span.endMs, toMs),
      source: span,
    });
  }
  return clipped;
}

/** Returns the span that fully contains the timestamp, if any. */
export function findSpanAt(spans: NormalizedSpan[], epochMs: number): NormalizedSpan | null {
  for (const span of spans) {
    if (epochMs >= span.startMs && epochMs < span.endMs) return span;
  }
  return null;
}

/** Returns the earliest span start strictly after the timestamp. */
export function findNextSpanStartAfter(spans: NormalizedSpan[], epochMs: number): number | null {
  let earliest: number | null = null;
  for (const span of spans) {
    if (span.startMs > epochMs && (earliest === null || span.startMs < earliest)) {
      earliest = span.startMs;
    }
  }
  return earliest;
}

/** Whether any span covers the timestamp. */
export function hasCoverageAt(spans: NormalizedSpan[], epochMs: number): boolean {
  return findSpanAt(spans, epochMs) !== null;
}

/**
 * Shared-clock gap skipping.
 *
 * Returns the next skip target only when EVERY provided stream lacks footage
 * at the shared timestamp: the earliest span start across all streams after
 * that timestamp. Returns null when any stream has coverage, when no stream
 * has later footage, or when any stream's intervals have not loaded yet
 * (skipping must never fire on partial data).
 */
export function computeGapSkipTarget(
  spansByStream: Array<NormalizedSpan[] | null | undefined>,
  epochMs: number
): number | null {
  if (spansByStream.length === 0) return null;

  let earliestNext: number | null = null;
  for (const spans of spansByStream) {
    if (!spans) return null;
    if (hasCoverageAt(spans, epochMs)) return null;

    const nextStart = findNextSpanStartAfter(spans, epochMs);
    if (nextStart === null) return null;
    if (earliestNext === null || nextStart < earliestNext) {
      earliestNext = nextStart;
    }
  }

  return earliestNext;
}
