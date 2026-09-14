import { create } from 'zustand';
import type { ServerInfo } from '@src/api/serverInfoApi';
import type { PathItem, PathList, Reader } from '@src/schemas/pathSchema';
import type { GlobalConfig } from '@src/types/config';
import { formatByteRate, formatUptime } from '@src/utils/formatters';
import { sumTransferRates, type TransferRate } from '@src/utils/transferRates';
import { isStreamRecordingEnabled } from '@src/utils/recordingStatus';
import { isStreamOnline } from '@src/utils/streamStatus';

export interface DashboardMetricCard {
  label: string;
  value: string | number;
  unit?: string;
  secondaryValue?: string | number;
  secondaryUnit?: string;
  description?: string;
}

export type InputProtocol = 'rtsp' | 'rtsps' | 'rtmp' | 'rtmps' | 'webrtc' | 'srt' | 'hls';

export interface DashboardMetrics {
  uptime: number;
  activePaths: number;
  recordingStreams: number;
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
  rtspInputs: number;
  rtspsInputs: number;
  rtmpInputs: number;
  rtmpsInputs: number;
  webRTCInputs: number;
  srtInputs: number;
  hlsInputs: number;
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
  const recordingStreams = pathItems.filter((path) => isStreamRecordingEnabled(path)).length;
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
  const inputCounts = countInputStreamsByProtocol(pathItems);
  const rtspInputs = isProtocolDisabled(globalConfig, 'rtsp') ? 0 : inputCounts.rtsp;
  const rtspsInputs = isProtocolDisabled(globalConfig, 'rtsp') ? 0 : inputCounts.rtsps;
  const rtmpInputs = isProtocolDisabled(globalConfig, 'rtmp') ? 0 : inputCounts.rtmp;
  const rtmpsInputs = isProtocolDisabled(globalConfig, 'rtmp') ? 0 : inputCounts.rtmps;
  const webRTCInputs = isProtocolDisabled(globalConfig, 'webrtc') ? 0 : inputCounts.webrtc;
  const srtInputs = isProtocolDisabled(globalConfig, 'srt') ? 0 : inputCounts.srt;
  const hlsInputs = isProtocolDisabled(globalConfig, 'hls') ? 0 : inputCounts.hls;

  return {
    uptime,
    activePaths,
    recordingStreams,
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
    rtspInputs,
    rtspsInputs,
    rtmpInputs,
    rtmpsInputs,
    webRTCInputs,
    srtInputs,
    hlsInputs,
    cards: buildDashboardMetricCards(
      {
        uptime,
        activePaths,
        recordingStreams,
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
        rtspInputs,
        rtspsInputs,
        rtmpInputs,
        rtmpsInputs,
        webRTCInputs,
        srtInputs,
        hlsInputs,
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
      label: 'Recording Streams',
      value: metrics.recordingStreams,
      description: 'Recording enabled streams',
    },
    {
      label: 'RTSP',
      value: metrics.rtspInputs,
      unit: 'IN',
      secondaryValue: metrics.rtspViewers,
      secondaryUnit: 'OUT',
    },
    {
      label: 'RTSPS',
      value: metrics.rtspsInputs,
      unit: 'IN',
      secondaryValue: metrics.rtspsViewers,
      secondaryUnit: 'OUT',
    },
    {
      label: 'RTMP',
      value: metrics.rtmpInputs,
      unit: 'IN',
      secondaryValue: metrics.rtmpViewers,
      secondaryUnit: 'OUT',
    },
    {
      label: 'RTMPS',
      value: metrics.rtmpsInputs,
      unit: 'IN',
      secondaryValue: metrics.rtmpsConnections,
      secondaryUnit: 'OUT',
    },
    {
      label: 'WebRTC',
      value: metrics.webRTCInputs,
      unit: 'IN',
      secondaryValue: metrics.webRTCViewers,
      secondaryUnit: 'OUT',
    },
    {
      label: 'SRT',
      value: metrics.srtInputs,
      unit: 'IN',
      secondaryValue: metrics.srtConnections,
      secondaryUnit: 'OUT',
    },
    {
      label: 'HLS',
      value: metrics.hlsInputs,
      unit: 'IN',
      secondaryValue: metrics.hlsViewers,
      secondaryUnit: 'OUT',
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

const INPUT_SOURCE_KINDS: Record<InputProtocol, string[]> = {
  rtsp: ['rtspSource', 'rtspSession', 'rtspConn', 'rtspConnection'],
  rtsps: ['rtspsSource', 'rtspsSession', 'rtspsConn', 'rtspsConnection'],
  rtmp: ['rtmpSource', 'rtmpConn', 'rtmpConnection'],
  rtmps: ['rtmpsSource', 'rtmpsConn', 'rtmpsConnection'],
  webrtc: ['webRTCSource', 'webRTCSession', 'webRTCConn', 'webRTCConnection'],
  srt: ['srtSource', 'srtConn', 'srtConnection'],
  hls: ['hlsSource', 'hlsClient'],
};

const INPUT_URL_PREFIXES: [InputProtocol, string[]][] = [
  ['rtsps', ['rtsps://']],
  ['rtsp', ['rtsp://']],
  ['rtmps', ['rtmps://']],
  ['rtmp', ['rtmp://']],
  ['srt', ['srt://']],
  ['hls', ['http://', 'https://']],
];

const inputSourceKindSets = Object.fromEntries(
  (Object.keys(INPUT_SOURCE_KINDS) as InputProtocol[]).map((protocol) => [
    protocol,
    new Set(INPUT_SOURCE_KINDS[protocol].map(normalizeKind)),
  ])
) as Record<InputProtocol, Set<string>>;

function countInputStreamsByProtocol(paths: PathItem[]): Record<InputProtocol, number> {
  const counts: Record<InputProtocol, number> = {
    rtsp: 0,
    rtsps: 0,
    rtmp: 0,
    rtmps: 0,
    webrtc: 0,
    srt: 0,
    hls: 0,
  };

  for (const path of paths) {
    if (!isStreamOnline(path)) continue;
    const protocol = classifyInputProtocol(path);
    if (protocol) counts[protocol] += 1;
  }

  return counts;
}

function classifyInputProtocol(path: PathItem): InputProtocol | null {
  const source = typeof path.source === 'string' ? path.source.trim().toLowerCase() : '';
  if (source !== '') {
    for (const [protocol, prefixes] of INPUT_URL_PREFIXES) {
      if (prefixes.some((prefix) => source.startsWith(prefix))) return protocol;
    }
  }

  const sourceInfo = path.sourceInfo;
  if (!sourceInfo) return null;

  for (const key of ['type', 'protocol']) {
    const value = sourceInfo[key];
    if (typeof value !== 'string' || value.trim() === '') continue;
    const normalized = normalizeKind(value);
    for (const protocol of Object.keys(inputSourceKindSets) as InputProtocol[]) {
      if (inputSourceKindSets[protocol].has(normalized)) return protocol;
    }
  }

  return null;
}

function isProtocolDisabled(config: GlobalConfig | undefined, key: keyof GlobalConfig): boolean {
  return config?.[key] === false;
}

function sanitizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export default useDashboardMetricsStore;
