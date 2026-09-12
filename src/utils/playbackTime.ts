/**
 * Timestamp helpers for recorded playback. Recorded media is addressed with
 * absolute epoch milliseconds, while the MediaMTX playback server speaks
 * RFC3339 timestamps and the timeline operates on local calendar days.
 */

/**
 * Formats an epoch-millisecond timestamp as RFC3339 UTC, which is the format
 * the playback server `/list` and `/get` endpoints parse.
 */
export function toRfc3339(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/**
 * Parses an RFC3339 timestamp (such as the `start` field of a playback span)
 * into epoch milliseconds. Returns null when the value cannot be parsed.
 */
export function parseRfc3339(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Formats an epoch-millisecond timestamp as a local `YYYY-MM-DD` day key. */
export function toDayKey(epochMs: number): string {
  const date = new Date(epochMs);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns the day key for "today" in the browser's timezone. */
export function todayDayKey(nowMs = Date.now()): string {
  return toDayKey(nowMs);
}

function isValidDayKeyParts(year: number, month: number, day: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= 1 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= 31
  );
}

/**
 * Parses a local `YYYY-MM-DD` day key into epoch milliseconds at local
 * midnight. Returns null for malformed keys.
 */
export function parseDayKey(dayKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidDayKeyParts(year, month, day)) return null;

  const midnight = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  // A month/day combination that overflows (e.g. February 31) rolls over in
  // the Date constructor; reject those instead of silently shifting the day.
  if (toDayKey(midnight) !== dayKey) return null;

  return midnight;
}

/**
 * Returns the [startMs, endMs) local-day window for a day key. Constructing
 * dates through the local-time constructors keeps the window correct across
 * daylight-saving transitions, including 23- and 25-hour days.
 */
export function getDayRangeMs(dayKey: string): { startMs: number; endMs: number } | null {
  const startMs = parseDayKey(dayKey);
  if (startMs === null) return null;

  const startDate = new Date(startMs);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  return { startMs, endMs: endDate.getTime() };
}

/** Adds a whole number of days to a day key, keeping local-time semantics. */
export function shiftDayKey(dayKey: string, dayDelta: number): string | null {
  const startMs = parseDayKey(dayKey);
  if (startMs === null) return null;

  const shifted = new Date(startMs);
  shifted.setDate(shifted.getDate() + dayDelta);
  return toDayKey(shifted.getTime());
}

/** Formats an epoch-millisecond timestamp for timestamp entry (local time). */
export function formatLocalTimeOfDay(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Parses `HH:mm[:ss]` local time on the given day key into epoch
 * milliseconds. Returns null when the value is malformed.
 */
export function parseLocalTimeOfDay(timeOfDay: string, dayKey: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeOfDay.trim());
  if (!match) return null;

  const dayStart = parseDayKey(dayKey);
  if (dayStart === null) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  // DST transitions can make local wall times nonexistent or ambiguous; the
  // Date constructor resolves both by shifting, which is acceptable for a
  // best-effort seek target.
  const candidate = new Date(dayStart);
  candidate.setHours(hours, minutes, seconds, 0);

  return candidate.getTime();
}
