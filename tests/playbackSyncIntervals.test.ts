import { describe, expect, test } from 'bun:test';
import {
  clipSpansToRange,
  computeGapSkipTarget,
  findNextSpanStartAfter,
  findSpanAt,
  gapsInRange,
  hasCoverageAt,
  normalizeSpans,
  unionRanges,
} from '../src/utils/playbackIntervals';
import type { PlaybackSpan } from '../src/schemas/recordingSchema';

const T0 = Date.UTC(2026, 0, 2, 0, 0, 0);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function span(startOffsetMs: number, durationSec: number): PlaybackSpan {
  return {
    start: new Date(T0 + startOffsetMs).toISOString(),
    duration: durationSec,
    url: `/get?start=${startOffsetMs}`,
  };
}

function numeric(startOffsetMs: number, endOffsetMs: number) {
  return { startMs: T0 + startOffsetMs, endMs: T0 + endOffsetMs };
}

describe('normalizeSpans', () => {
  test('preserves interval boundaries instead of merging adjacent spans', () => {
    // Two adjacent one-hour spans (10:00-11:00 and 11:00-12:00).
    const normalized = normalizeSpans([span(HOUR * 10, 3600), span(HOUR * 11, 3600)]);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].endMs).toBe(T0 + HOUR * 11);
    expect(normalized[1].startMs).toBe(T0 + HOUR * 11);
  });

  test('sorts spans by start time and drops invalid entries', () => {
    const normalized = normalizeSpans([
      span(HOUR * 12, 600),
      span(HOUR * 9, 600),
      { start: 'not-a-date', duration: 10, url: '' },
      span(HOUR * 13, 0), // zero duration is dropped
    ]);

    expect(normalized.map((entry) => entry.startMs)).toEqual([
      T0 + HOUR * 9,
      T0 + HOUR * 12,
    ]);
  });
});

describe('unionRanges', () => {
  test('merges overlapping and adjacent coverage for display only', () => {
    const union = unionRanges([
      numeric(0, 10),
      numeric(5, 20),
      numeric(30, 40),
      numeric(40, 50),
    ]);

    expect(union).toEqual([numeric(0, 20), numeric(30, 50)]);
  });

  test('handles unsorted input and empty coverage', () => {
    expect(unionRanges([numeric(30, 40), numeric(0, 10)])).toEqual([
      numeric(0, 10),
      numeric(30, 40),
    ]);
    expect(unionRanges([])).toEqual([]);
  });
});

describe('gapsInRange', () => {
  test('computes visible gaps as the complement of coverage in a window', () => {
    const gaps = gapsInRange([numeric(10, 20), numeric(30, 40)], T0, T0 + 50);

    expect(gaps).toEqual([
      { startMs: T0, endMs: T0 + 10 },
      { startMs: T0 + 20, endMs: T0 + 30 },
      { startMs: T0 + 40, endMs: T0 + 50 },
    ]);
  });

  test('clips gaps to the inspected window', () => {
    // Coverage crossing both window edges leaves a single interior gap.
    const gaps = gapsInRange([numeric(-10, 2), numeric(4, 10)], T0, T0 + 5);
    expect(gaps).toEqual([{ startMs: T0 + 2, endMs: T0 + 4 }]);

    // Coverage fully containing the window leaves no gap.
    expect(gapsInRange([numeric(-10, 5)], T0, T0 + 3)).toEqual([]);
  });

  test('returns the whole window when there is no coverage', () => {
    expect(gapsInRange([], 100, 200)).toEqual([{ startMs: 100, endMs: 200 }]);
  });
});

describe('clipSpansToRange', () => {
  test('clips span boundaries to the day window without merging spans', () => {
    // One span crossing local midnight and one entirely inside the day.
    const spans = normalizeSpans([span(-HOUR, 7200), span(0, 3600)]);
    const clipped = clipSpansToRange(spans, T0, T0 + HOUR);

    expect(clipped).toHaveLength(2);
    expect(clipped[0]).toMatchObject({ startMs: T0, endMs: T0 + HOUR });
    expect(clipped[1]).toMatchObject({ startMs: T0, endMs: T0 + HOUR });
  });

  test('drops spans entirely outside the window', () => {
    const spans = normalizeSpans([span(HOUR * 30, 3600), span(0, 600)]);
    const clipped = clipSpansToRange(spans, T0, T0 + HOUR);
    expect(clipped).toHaveLength(1);
    expect(clipped[0].source).toBe(spans[0]);
  });
});

describe('coverage lookups', () => {
  const spans = normalizeSpans([span(HOUR * 9, 3600), span(HOUR * 11, 3600)]);

  test('finds the containing span with inclusive start and exclusive end', () => {
    expect(findSpanAt(spans, T0 + HOUR * 9)?.startMs).toBe(T0 + HOUR * 9);
    expect(findSpanAt(spans, T0 + HOUR * 10 - 1)?.startMs).toBe(T0 + HOUR * 9);
    expect(findSpanAt(spans, T0 + HOUR * 10)).toBeNull();
    expect(findSpanAt(spans, T0 + HOUR * 8)).toBeNull();
  });

  test('finds the earliest next span start and coverage checks', () => {
    expect(findNextSpanStartAfter(spans, T0 + HOUR * 8)).toBe(T0 + HOUR * 9);
    expect(findNextSpanStartAfter(spans, T0 + HOUR * 9 + MIN)).toBe(T0 + HOUR * 11);
    expect(findNextSpanStartAfter(spans, T0 + HOUR * 20)).toBeNull();

    expect(hasCoverageAt(spans, T0 + HOUR * 9)).toBe(true);
    expect(hasCoverageAt(spans, T0 + HOUR * 10)).toBe(false);
  });
});

describe('computeGapSkipTarget', () => {
  const morning = normalizeSpans([span(HOUR * 9, 3600)]);
  const lateMorning = normalizeSpans([span(HOUR * 10, 1800)]);

  test('skips only when every stream lacks footage at the shared timestamp', () => {
    // 09:30: morning stream covered, late stream not -> no skip.
    expect(computeGapSkipTarget([morning, lateMorning], T0 + HOUR * 9 + 30 * MIN)).toBeNull();

    // 08:00: neither stream has footage -> earliest next start wins.
    expect(computeGapSkipTarget([morning, lateMorning], T0 + HOUR * 8)).toBe(T0 + HOUR * 9);
  });

  test('never skips on partial interval data', () => {
    expect(computeGapSkipTarget([morning, undefined], T0 + HOUR * 8)).toBeNull();
    expect(computeGapSkipTarget([morning, null], T0 + HOUR * 8)).toBeNull();
    expect(computeGapSkipTarget([], T0)).toBeNull();
  });

  test('returns null when no stream has later footage', () => {
    expect(computeGapSkipTarget([morning, lateMorning], T0 + HOUR * 20)).toBeNull();
  });

  test('an empty span list is a fully loaded stream without footage', () => {
    // Empty stream has no next span, so the skip target stays null.
    expect(computeGapSkipTarget([[], morning], T0 + HOUR * 8)).toBeNull();
    // But with an empty list alone, there is nothing to skip to either.
    expect(computeGapSkipTarget([[]], T0 + HOUR * 8)).toBeNull();
  });
});
