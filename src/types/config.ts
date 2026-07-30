export interface GlobalConfig {
  logLevel: string;
  logDestinations: string[];
  logFile: string;
  readTimeout: string;
  writeTimeout: string;
  readBufferCount: number;
  udpMaxPayloadSize: number;
  api?: boolean;
  apiAddress: string;
  metrics?: boolean;
  metricsAddress: string;
  pprof?: boolean;
  pprofAddress?: string;
  playback?: boolean;
  playbackAddress?: string;
  rtsp?: boolean;
  hlsAddress: string;
  rtspAddress: string;
  rtspsAddress?: string;
  rtmp?: boolean;
  rtmpAddress: string;
  rtmpsAddress?: string;
  hls?: boolean;
  webrtc?: boolean;
  webrtcAddress: string;
  srt?: boolean;
  srtAddress?: string;
  paths: Record<string, PathConfig>;
}

export interface PathConfig {
  source: string;
  sourceProtocol: string;
  sourceAnyPublisher: boolean;
  record: boolean;
  playback: boolean;
  maxReaders: number;
}

export type RawPathConfig = Record<string, unknown> & {
  name?: string;
};

export type RawGlobalConfig = Record<string, unknown>;

export type CompleteServerConfig = RawGlobalConfig & {
  pathDefaults: Record<string, unknown>;
  paths: Record<string, Omit<RawPathConfig, 'name'>>;
};
