import { apiFetch } from '@src/api/client';

export interface ServerInfo {
  version: string;
  started: string;
  uptime: number;
}

interface RawServerInfo {
  version?: unknown;
  started?: unknown;
  [key: string]: unknown;
}

const RFC3339_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

export async function getServerInfo(serverUrl?: string): Promise<ServerInfo> {
  const raw = await apiFetch<RawServerInfo>('/v3/info', undefined, serverUrl);
  const version = typeof raw.version === 'string' ? raw.version : '';
  const started = typeof raw.started === 'string' ? raw.started : '';
  const startedAt = parseStartedTimestamp(started);
  const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const uptime = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;

  return { version, started, uptime };
}

function parseStartedTimestamp(started: string): number {
  const match = RFC3339_TIMESTAMP.exec(started);
  if (!match) return Number.NaN;

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHour,
    offsetMinute,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (offsetHour !== undefined && Number(offsetHour) > 23) ||
    (offsetMinute !== undefined && Number(offsetMinute) > 59)
  ) {
    return Number.NaN;
  }

  return Date.parse(started);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
