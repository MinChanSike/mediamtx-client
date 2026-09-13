import { describe, expect, test } from 'bun:test';
import {
  formatLocalTimeOfDay,
  getDayRangeMs,
  parseDayKey,
  parseLocalTimeOfDay,
  parseRfc3339,
  shiftDayKey,
  toDayKey,
  toRfc3339,
  todayDayKey,
} from '../src/utils/playbackTime';

const HOUR = 60 * 60 * 1000;

describe('RFC3339 round trips', () => {
  test('formats and parses epoch milliseconds losslessly', () => {
    const value = Date.UTC(2026, 0, 2, 9, 15, 30, 250);
    expect(toRfc3339(value)).toBe('2026-01-02T09:15:30.250Z');
    expect(parseRfc3339('2026-01-02T09:15:30.250Z')).toBe(value);
    expect(parseRfc3339('2026-01-02T09:15:30Z')).toBe(Date.UTC(2026, 0, 2, 9, 15, 30));
  });

  test('returns null for unparseable timestamps', () => {
    expect(parseRfc3339('nope')).toBeNull();
    expect(parseRfc3339('')).toBeNull();
  });
});

describe('day keys', () => {
  test('round-trips local day keys through parsing and formatting', () => {
    const now = Date.now();
    const key = todayDayKey(now);
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const parsed = parseDayKey(key);
    expect(parsed).not.toBeNull();
    expect(toDayKey(parsed!)).toBe(key);
  });

  test('rejects malformed or overflowing day keys', () => {
    expect(parseDayKey('2026-1-2')).toBeNull();
    expect(parseDayKey('not-a-day')).toBeNull();
    expect(parseDayKey('')).toBeNull();
    expect(parseDayKey('2026-13-01')).toBeNull();
    expect(parseDayKey('2026-02-31')).toBeNull(); // rolls over to March
  });

  test('day ranges span a whole local day regardless of DST transitions', () => {
    // Any local day must resolve to a window of 23-25 hours (DST shifts) and
    // end exactly where the next day starts.
    for (const key of ['2026-01-02', '2026-03-08', '2026-11-01', '2026-06-21']) {
      const range = getDayRangeMs(key)!;
      const width = range.endMs - range.startMs;
      expect(width).toBeGreaterThanOrEqual(23 * HOUR);
      expect(width).toBeLessThanOrEqual(25 * HOUR);

      const next = shiftDayKey(key, 1);
      expect(next).not.toBeNull();
      expect(getDayRangeMs(next!)!.startMs).toBe(range.endMs);
    }
  });

  test('shifts day keys by whole days in both directions', () => {
    expect(shiftDayKey('2026-01-02', -1)).toBe('2026-01-01');
    expect(shiftDayKey('2026-01-02', 30)).toBe('2026-02-01');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('bad', 1)).toBeNull();
  });
});

describe('local time of day', () => {
  test('formats local HH:mm:ss', () => {
    const localMidnight = parseDayKey(todayDayKey())!;
    const date = new Date(localMidnight + 0);
    const expected = `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}:${`${date.getSeconds()}`.padStart(2, '0')}`;
    expect(formatLocalTimeOfDay(localMidnight)).toBe(expected);
  });

  test('parses HH:mm and HH:mm:ss entries on the selected day', () => {
    const dayKey = todayDayKey();
    const dayStart = parseDayKey(dayKey)!;

    const nine = parseLocalTimeOfDay('09:30', dayKey)!;
    const nineDate = new Date(nine);
    expect(nine).toBeGreaterThanOrEqual(dayStart);
    expect(nineDate.getHours()).toBe(9);
    expect(nineDate.getMinutes()).toBe(30);
    expect(nineDate.getSeconds()).toBe(0);

    const withSeconds = parseLocalTimeOfDay('09:30:45', dayKey)!;
    expect(new Date(withSeconds).getSeconds()).toBe(45);

    // 24h boundary: 23:59:59 stays on the day.
    expect(parseLocalTimeOfDay('23:59:59', dayKey)).not.toBeNull();
  });

  test('rejects malformed times', () => {
    const dayKey = todayDayKey();
    expect(parseLocalTimeOfDay('24:00', dayKey)).toBeNull();
    expect(parseLocalTimeOfDay('09:60', dayKey)).toBeNull();
    expect(parseLocalTimeOfDay('abc', dayKey)).toBeNull();
    expect(parseLocalTimeOfDay('09:30', 'nope')).toBeNull();
  });
});
