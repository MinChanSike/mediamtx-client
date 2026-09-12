import type { PathItem } from '@src/types/stream';

export const LIVE_REFRESH_MS = 3000;
export const RATE_STALE_MS = LIVE_REFRESH_MS * 2;

export interface TransferRate {
  inboundBytesPerSecond: number | null;
  outboundBytesPerSecond: number | null;
}

export const UNAVAILABLE_RATE: TransferRate = {
  inboundBytesPerSecond: null,
  outboundBytesPerSecond: null,
};

export interface TransferSample {
  at: number;
  identity: string;
  inbound: number | null;
  outbound: number | null;
}

export function normalizeCounter(path: PathItem, direction: 'inbound' | 'outbound'): number | null {
  const fields =
    direction === 'inbound'
      ? ['inboundBytes', 'bytesReceived', 'totalBytesReceived']
      : ['outboundBytes', 'bytesSent', 'totalBytesSent'];
  for (const field of fields) {
    const value = path[field];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

export function sampleTransferRates(
  paths: PathItem[],
  previous: Record<string, TransferSample>,
  at: number
) {
  const samples: Record<string, TransferSample> = Object.create(null);
  const rates: Record<string, TransferRate> = Object.create(null);
  for (const path of paths) {
    const sample: TransferSample = {
      at,
      identity: JSON.stringify([
        path.source,
        path.sourceInfo?.type,
        path.sourceInfo?.id,
        path.onlineTime,
        path.availableTime,
        path.readyTime,
        path.online,
        path.available,
        path.ready,
        path.sourceState,
      ]),
      inbound: normalizeCounter(path, 'inbound'),
      outbound: normalizeCounter(path, 'outbound'),
    };
    const before = Object.prototype.hasOwnProperty.call(previous, path.name)
      ? previous[path.name]
      : undefined;
    const elapsed = before ? at - before.at : 0;
    const reset =
      !before ||
      sample.identity !== before.identity ||
      elapsed <= 0 ||
      elapsed > RATE_STALE_MS ||
      (sample.inbound !== null && before.inbound !== null && sample.inbound < before.inbound) ||
      (sample.outbound !== null && before.outbound !== null && sample.outbound < before.outbound);
    const rate = (current: number | null, old: number | null | undefined) =>
      reset || current === null || old == null ? null : ((current - old) * 1000) / elapsed;
    rates[path.name] = {
      inboundBytesPerSecond: rate(sample.inbound, before?.inbound),
      outboundBytesPerSecond: rate(sample.outbound, before?.outbound),
    };
    samples[path.name] = sample;
  }
  return { samples, rates };
}

export function sumTransferRates(paths: PathItem[], rates: Record<string, TransferRate>) {
  function sum(key: keyof TransferRate) {
    const values = paths.map((path) => rates[path.name]?.[key] ?? null);
    const valid = values.filter((value): value is number => value !== null);
    return {
      value: paths.length === 0 ? 0 : valid.length ? valid.reduce((a, b) => a + b, 0) : null,
      partial: valid.length !== values.length,
    };
  }
  return {
    inbound: sum('inboundBytesPerSecond'),
    outbound: sum('outboundBytesPerSecond'),
  };
}

export function compareTransferRates(a: number | null, b: number | null, descending = false) {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return (a - b) * (descending ? -1 : 1);
}
