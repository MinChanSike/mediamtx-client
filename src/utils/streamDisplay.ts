import type { PathItem, Reader } from '@src/types/stream';
import { detectInputProtocol } from '@src/utils/protocolDetector';

const SOURCE_TYPE_PROTOCOL_PREFIXES = [
  ['rtsp', 'rtsp'],
  ['rtmp', 'rtmp'],
  ['srt', 'srt'],
  ['hls', 'hls'],
  ['webrtc', 'webrtc'],
] as const;

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function getDisplayProtocol(stream: PathItem | null) {
  if (!stream) return 'unknown';

  const sourceProtocol = detectInputProtocol(stream.source);
  if (sourceProtocol !== 'unknown') return sourceProtocol;

  const sourceType = getStringValue(stream.sourceInfo?.type);
  if (!sourceType) return sourceProtocol;

  const normalizedSourceType = sourceType.toLowerCase();
  const protocolMatch = SOURCE_TYPE_PROTOCOL_PREFIXES.find(([prefix]) => normalizedSourceType.startsWith(prefix));
  if (protocolMatch) return protocolMatch[1];

  return detectInputProtocol(sourceType);
}

export interface KickTarget {
  id: string;
  type: string;
  endpoint: string;
}

export interface ViewerDetailTarget {
  id: string;
  type: string;
  endpoint: string;
}

const KICK_ENDPOINT_BY_TYPE: Record<string, string> = {
  hlssession: 'hlssessions',
  rtmpconn: 'rtmpconns',
  rtmpsconn: 'rtmpsconns',
  rtspsession: 'rtspsessions',
  rtspconn: '',
  rtspsconn: '',
  rtspssession: 'rtspssessions',
  srtconn: 'srtconns',
  webrtcsession: 'webrtcsessions',
  moqsession: 'moqsessions',
};

const VIEWER_DETAIL_ENDPOINT_BY_TYPE: Record<string, string> = {
  hlssession: 'hlssessions',
  rtspconn: 'rtspconns',
  rtspsconn: 'rtspsconns',
  rtspsession: 'rtspsessions',
  rtspssession: 'rtspssessions',
  rtmpconn: 'rtmpconns',
  rtmpsconn: 'rtmpsconns',
  srtconn: 'srtconns',
  webrtcsession: 'webrtcsessions',
  moqsession: 'moqsessions',
};

function getKickEndpoint(type: string) {
  return KICK_ENDPOINT_BY_TYPE[type.toLowerCase()] || null;
}

function getViewerDetailEndpoint(type: string) {
  return VIEWER_DETAIL_ENDPOINT_BY_TYPE[type.toLowerCase()] || null;
}

export function getKickTargetFromInfo(info: Record<string, unknown> | null | undefined): KickTarget | null {
  const id = getStringValue(info?.id);
  const type = getStringValue(info?.type);
  if (!id || !type) return null;

  const endpoint = getKickEndpoint(type);
  if (!endpoint) return null;

  return { id, type, endpoint };
}

export function getKickTargetFromReader(reader: Reader): KickTarget | null {
  return getKickTargetFromInfo(reader);
}

export function getSourceKickTarget(stream: PathItem): KickTarget | null {
  return getKickTargetFromInfo(stream.sourceInfo);
}

export function getReaderKickTargets(stream: PathItem): KickTarget[] {
  return stream.readers.map(getKickTargetFromReader).filter((target): target is KickTarget => !!target);
}

export function getViewerDetailTargetFromInfo(
  info: Record<string, unknown> | null | undefined,
): ViewerDetailTarget | null {
  const id = getStringValue(info?.id);
  const type = getStringValue(info?.type);
  if (!id || !type) return null;

  const endpoint = getViewerDetailEndpoint(type);
  if (!endpoint) return null;

  return { id, type, endpoint };
}

export function getViewerDetailTargetFromReader(reader: Reader): ViewerDetailTarget | null {
  return getViewerDetailTargetFromInfo(reader);
}
