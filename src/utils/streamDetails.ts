import type { PathItem, Reader } from '@src/types/stream';
import {
  getKickTargetFromReader,
  getViewerDetailTargetFromReader,
  type KickTarget,
  type ViewerDetailTarget,
} from '@src/utils/streamDisplay';

export type PrimitiveDetailValue = string | number | boolean;

export interface PrimitiveDetail {
  key: string;
  value: PrimitiveDetailValue;
}

export interface ViewerTableRow {
  key: string;
  identity: string;
  type: string;
  details: PrimitiveDetail[];
  kickTarget: KickTarget | null;
  detailTarget: ViewerDetailTarget | null;
  reader: Reader;
}

export const VIEWER_TABLE_COLUMNS = ['ID', 'Type'] as const;

export const DISPLAYED_STREAM_DETAIL_KEYS = [
  'name',
  'source',
  'sourceInfo',
  'sourceState',
  'sourceError',
  'tracks',
  'readers',
  'bytesReceived',
  'bytesSent',
  'inboundBytes',
  'outboundBytes',
  'totalBytesReceived',
  'totalBytesSent',
  'isConfigured',
] as const;

export const DISPLAYED_READER_DETAIL_KEYS = [
  'id',
  'type',
  'state',
  'remoteAddr',
  'ip',
  'protocol',
  'created',
  'startTime',
  'startedAt',
] as const;

const ADDITIONAL_DETAIL_FIELDS = [
  { label: 'Config Name', keys: ['confName', 'configName', 'configurationName'] },
  { label: 'Ready', keys: ['ready'] },
  { label: 'Read Time', keys: ['readyTime', 'readTime'] },
  { label: 'Available', keys: ['available'] },
  { label: 'Available Time', keys: ['availableTime'] },
  { label: 'Online', keys: ['online'] },
  { label: 'Online Time', keys: ['onlineTime'] },
  { label: 'Inbound Frame Errors', keys: ['inboundFramesInError', 'inboundFrameErrors'] },
] as const;

const LOCAL_TIME_DETAIL_LABELS = new Set(['Read Time', 'Available Time', 'Online Time']);

function isPrimitiveDetailValue(value: unknown): value is PrimitiveDetailValue {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getPrimitiveDetails(
  item: Record<string, unknown>,
  omittedKeys: readonly string[],
): PrimitiveDetail[] {
  return Object.entries(item).reduce<PrimitiveDetail[]>((details, [key, value]) => {
    if (!omittedKeys.includes(key) && isPrimitiveDetailValue(value)) {
      details.push({ key, value });
    }

    return details;
  }, []);
}

export function getAdditionalStreamDetails(stream: PathItem, pathDetail: unknown): PrimitiveDetail[] {
  const detailsByLabel = new Map<string, PrimitiveDetailValue>();

  for (const field of ADDITIONAL_DETAIL_FIELDS) {
    const value = findPrimitiveValueByKeyPriority([stream, pathDetail], field.keys);
    if (typeof value !== 'undefined') {
      detailsByLabel.set(field.label, formatAdditionalDetailValue(field.label, value));
    }
  }

  return Array.from(detailsByLabel, ([key, value]) => ({ key, value }));
}

function formatAdditionalDetailValue(
  label: string,
  value: PrimitiveDetailValue,
): PrimitiveDetailValue {
  if (!LOCAL_TIME_DETAIL_LABELS.has(label)) return value;
  if (typeof value === 'boolean') return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function resolveLatestDetailsStream(
  selectedStream: PathItem | null,
  latestStreams: readonly PathItem[],
): PathItem | null {
  if (!selectedStream) return null;
  return latestStreams.find((stream) => stream.name === selectedStream.name) ?? selectedStream;
}

export function getReaderIp(reader: Reader) {
  return reader.remoteAddr || reader.ip || '-';
}

export function getReaderProtocol(reader: Reader) {
  return reader.protocol || reader.type || '-';
}

export function getReaderStartTime(reader: Reader) {
  return reader.created || reader.startTime || reader.startedAt;
}

export function getViewerTableRows(readers: readonly Reader[]): ViewerTableRow[] {
  return readers.map((reader, index) => ({
    key: reader.id || String(index),
    identity: reader.id || '-',
    type: reader.type || '-',
    details: getPrimitiveDetails(reader, DISPLAYED_READER_DETAIL_KEYS),
    kickTarget: getKickTargetFromReader(reader),
    detailTarget: getViewerDetailTargetFromReader(reader),
    reader,
  }));
}

function findPrimitiveValue(
  sources: readonly unknown[],
  keys: readonly string[],
): PrimitiveDetailValue | undefined {
  for (const source of sources) {
    if (!isRecord(source)) continue;

    for (const key of keys) {
      const value = source[key];
      if (isPrimitiveDetailValue(value)) return value;
    }
  }

  return undefined;
}

function findPrimitiveValueByKeyPriority(
  sources: readonly unknown[],
  keys: readonly string[],
): PrimitiveDetailValue | undefined {
  for (const key of keys) {
    for (const source of sources) {
      if (!isRecord(source)) continue;

      const value = source[key];
      if (isPrimitiveDetailValue(value)) return value;
    }
  }

  return undefined;
}

export function getSourceIdentityDetails(stream: PathItem, pathDetail: unknown): PrimitiveDetail[] {
  const sourceInfo = isRecord(stream.sourceInfo) ? stream.sourceInfo : null;
  const pathSource = isRecord(pathDetail) && isRecord(pathDetail.source) ? pathDetail.source : null;
  const id = findPrimitiveValue([sourceInfo, pathDetail, pathSource], ['id', 'sourceId']);
  const type = findPrimitiveValue(
    [sourceInfo, pathDetail, pathSource],
    ['type', 'sourceType'],
  );

  return [
    { key: 'ID', value: id ?? stream.name },
    ...(typeof type !== 'undefined' ? [{ key: 'Type', value: type }] : []),
  ];
}

export function getSourcePrimitiveDetails(stream: PathItem): PrimitiveDetail[] {
  return isRecord(stream.sourceInfo)
    ? getPrimitiveDetails(stream.sourceInfo, ['id', 'sourceId', 'type', 'sourceType'])
    : [];
}

export function getFetchedViewerPrimitiveDetails(viewerDetail: unknown): PrimitiveDetail[] {
  return isRecord(viewerDetail)
    ? getPrimitiveDetails(viewerDetail, ['id', 'type'])
    : [];
}
