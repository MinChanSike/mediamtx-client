import { create } from 'zustand';
import type { ServerInfo } from '@src/api/serverInfoApi';
import type { PathItem, PathList, Reader } from '@src/schemas/pathSchema';
import type { GlobalConfig } from '@src/types/config';
import { formatByteRate, formatUptime } from '@src/utils/formatters';
import { sumTransferRates, type TransferRate } from '@src/utils/transferRates';
import { isStreamOnline } from '@src/utils/streamStatus';

export interface DashboardMetricCard {
  label: string;
  value: string | number;
  description: string;
}

export interface DashboardMetrics {
  uptime: number;
  activePaths: number;
  inboundBytesPerSecond: number | null;
  outboundBytesPerSecond: number | null;
  ingressPartial: boolean;
  egressPartial: boolean;
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
  rates?: Record<string, TransferRate>;
  ratesStatus?: 'unavailable' | 'fresh' | 'stale';
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
  rates = {},
  ratesStatus = 'unavailable',
  paths,
  globalConfig,
  serverInfo,
}: DashboardMetricsInputs): DashboardMetrics {
  const pathItems = paths?.items ?? [];
  const uptime = sanitizeCount(serverInfo?.uptime);
  const activePaths = pathItems.filter(isStreamOnline).length;
  const totals = sumTransferRates(pathItems, rates);
  const inboundBytesPerSecond = ratesStatus === 'fresh' ? totals.inbound.value : null;
  const outboundBytesPerSecond = ratesStatus === 'fresh' ? totals.outbound.value : null;
  const ingressPartial = ratesStatus === 'fresh' && totals.inbound.partial;
  const egressPartial = ratesStatus === 'fresh' && totals.outbound.partial;
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
    inboundBytesPerSecond,
    outboundBytesPerSecond,
    ingressPartial,
    egressPartial,
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
        inboundBytesPerSecond,
        outboundBytesPerSecond,
        ingressPartial,
        egressPartial,
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
      description: 'Online streams',
    },
    {
      label: 'Ingress',
      value: formatByteRate(metrics.inboundBytesPerSecond),
      description: metrics.ingressPartial ? 'Partial · Waiting for samples' : 'Received by server',
    },
    {
      label: 'Egress',
      value: formatByteRate(metrics.outboundBytesPerSecond),
      description: metrics.egressPartial ? 'Partial · Waiting for samples' : 'Sent by server',
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
