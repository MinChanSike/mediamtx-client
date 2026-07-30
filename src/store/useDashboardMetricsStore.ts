import { create } from 'zustand';
import type { ServerInfo } from '@src/api/serverInfoApi';
import type { PathItem, PathList, Reader } from '@src/schemas/pathSchema';
import type { GlobalConfig } from '@src/types/config';
import { formatBytes, formatUptime } from '@src/utils/formatters';

export interface DashboardMetricCard {
  label: string;
  value: string | number;
  description: string;
}

export interface DashboardMetrics {
  uptime: number;
  activePaths: number;
  bytesReceived: number;
  bytesSent: number;
  rtspViewers: number;
  rtspsViewers: number;
  rtmpViewers: number;
  rtmpsConnections: number;
  webRTCViewers: number;
  srtConnections: number;
  hlsViewers: number;
  totalViewers: number;
  cards: DashboardMetricCard[];
}

interface DashboardMetricsInputs {
  paths?: PathList;
  globalConfig?: GlobalConfig;
  serverInfo?: ServerInfo;
}

interface DashboardMetricsState {
  metrics: DashboardMetrics;
  recalculate: (inputs: DashboardMetricsInputs) => void;
}

const emptyMetrics = calculateDashboardMetrics({});

const useDashboardMetricsStore = create<DashboardMetricsState>((set) => ({
  metrics: emptyMetrics,
  recalculate: (inputs) => set({ metrics: calculateDashboardMetrics(inputs) }),
}));

export function calculateDashboardMetrics({
  paths,
  globalConfig,
  serverInfo,
}: DashboardMetricsInputs): DashboardMetrics {
  const pathItems = paths?.items ?? [];
  const uptime = sanitizeCount(serverInfo?.uptime);
  const activePaths = sanitizeCount(paths?.itemCount ?? pathItems.length);
  const bytesReceived = pathItems.reduce(
    (total, path) =>
      total + getPathByteTotal(path, ['bytesReceived', 'inboundBytes', 'totalBytesReceived']),
    0
  );
  const bytesSent = pathItems.reduce(
    (total, path) =>
      total + getPathByteTotal(path, ['bytesSent', 'outboundBytes', 'totalBytesSent']),
    0
  );
  const rtspViewers = isProtocolDisabled(globalConfig, 'rtsp')
    ? 0
    : countReaders(pathItems, ['rtspSession']);
  const rtspsViewers = isProtocolDisabled(globalConfig, 'rtsp')
    ? 0
    : countReaders(pathItems, ['rtspsSession']);
  const rtmpViewers = isProtocolDisabled(globalConfig, 'rtmp')
    ? 0
    : countReaders(pathItems, ['rtmpConn', 'rtmpConnection', 'rtmp']);
  const rtmpsConnections = isProtocolDisabled(globalConfig, 'rtmp')
    ? 0
    : countReaders(pathItems, ['rtmpsConn', 'rtmpsConnection', 'rtmps']);
  const webRTCViewers = isProtocolDisabled(globalConfig, 'webrtc')
    ? 0
    : countReaders(pathItems, ['webrtcSession', 'webrtcConn', 'webrtcConnection', 'webrtc']);
  const srtConnections = isProtocolDisabled(globalConfig, 'srt')
    ? 0
    : countReaders(pathItems, ['srtConn', 'srtConnection', 'srt']);
  const hlsViewers = isProtocolDisabled(globalConfig, 'hls')
    ? 0
    : countReaders(pathItems, ['hlsSession', 'hlsMuxer', 'hls']);
  const totalViewers =
    rtspViewers +
    rtspsViewers +
    rtmpViewers +
    rtmpsConnections +
    webRTCViewers +
    srtConnections +
    hlsViewers;

  return {
    uptime,
    activePaths,
    bytesReceived,
    bytesSent,
    rtspViewers,
    rtspsViewers,
    rtmpViewers,
    rtmpsConnections,
    webRTCViewers,
    srtConnections,
    hlsViewers,
    totalViewers,
    cards: buildDashboardMetricCards(
      {
        uptime,
        activePaths,
        bytesReceived,
        bytesSent,
        rtspViewers,
        rtspsViewers,
        rtmpViewers,
        rtmpsConnections,
        webRTCViewers,
        srtConnections,
        hlsViewers,
        totalViewers,
      },
      serverInfo?.version,
      serverInfo !== undefined
    ),
  };
}

function buildDashboardMetricCards(
  metrics: Omit<DashboardMetrics, 'cards'>,
  serverVersion: string | undefined,
  hasServerInfo: boolean
): DashboardMetricCard[] {
  return [
    {
      label: 'Uptime',
      value: hasServerInfo ? formatUptime(metrics.uptime) : '-',
      description: serverVersion ? `MediaMTX ${serverVersion}` : 'MediaMTX version unavailable',
    },
    {
      label: 'Active Streams',
      value: metrics.activePaths,
      description: 'Configured streams',
    },
    {
      label: 'Bytes Received',
      value: formatBytes(metrics.bytesReceived),
      description: 'Total ingress',
    },
    {
      label: 'Bytes Sent',
      value: formatBytes(metrics.bytesSent),
      description: 'Total egress',
    },
    {
      label: 'RTSP Readers',
      value: metrics.rtspViewers,
      description: 'Active RTSP readers',
    },
    {
      label: 'RTSPS Readers',
      value: metrics.rtspsViewers,
      description: 'Active RTSPS readers',
    },
    {
      label: 'RTMP Readers',
      value: metrics.rtmpViewers,
      description: 'Active RTMP readers',
    },
    {
      label: 'RTMPS READERS',
      value: metrics.rtmpsConnections,
      description: 'Active RTMPS readers',
    },
    {
      label: 'WebRTC Readers',
      value: metrics.webRTCViewers,
      description: 'Active WebRTC readers',
    },
    {
      label: 'SRT READERS',
      value: metrics.srtConnections,
      description: 'Active SRT readers',
    },
    {
      label: 'HLS Readers',
      value: metrics.hlsViewers,
      description: 'Active HLS readers',
    },
    {
      label: 'Total Readers',
      value: metrics.totalViewers,
      description: 'All displayed active readers',
    },
  ];
}

function getPathByteTotal(path: PathItem, fields: Array<keyof PathItem>): number {
  for (const field of fields) {
    const value = path[field];
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(value, 0);
  }
  return 0;
}

function countReaders(paths: PathItem[], readerKinds: string[]): number {
  const normalizedKinds = new Set(readerKinds.map(normalizeKind));

  return paths.reduce((total, path) => {
    return (
      total + (path.readers ?? []).filter((reader) => readerMatches(reader, normalizedKinds)).length
    );
  }, 0);
}

function readerMatches(reader: Reader, normalizedKinds: Set<string>): boolean {
  return [reader.type, reader.protocol].some((value) => {
    return typeof value === 'string' && normalizedKinds.has(normalizeKind(value));
  });
}

function normalizeKind(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isProtocolDisabled(config: GlobalConfig | undefined, key: keyof GlobalConfig): boolean {
  return config?.[key] === false;
}

function sanitizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export default useDashboardMetricsStore;
