import { z } from 'zod';

export const pathConfigSchema = z.object({
  source: z.string().default(''),
  sourceProtocol: z.string().default('automatic'),
  sourceAnyPublisher: z.boolean().default(true),
  record: z.boolean().default(false),
  playback: z.boolean().default(false),
  maxReaders: z.number().int().nonnegative().default(0),
});

export const globalConfigSchema = z.object({
  logLevel: z.string().default('info'),
  logDestinations: z.array(z.string()).default(['stdout']),
  logFile: z.string().default('mediamtx.log'),
  readTimeout: z.string().default('10s'),
  writeTimeout: z.string().default('10s'),
  readBufferCount: z.number().int().positive().default(512),
  udpMaxPayloadSize: z.number().int().positive().default(1472),
  api: z.boolean().optional(),
  apiAddress: z.string().default('127.0.0.1:9997'),
  metrics: z.boolean().optional(),
  metricsAddress: z.string().default('127.0.0.1:9998'),
  pprof: z.boolean().optional(),
  pprofAddress: z.string().optional(),
  playback: z.boolean().optional(),
  playbackAddress: z.string().optional(),
  rtsp: z.boolean().optional(),
  hlsAddress: z.string().default(':8888'),
  rtspAddress: z.string().default(':8554'),
  rtspsAddress: z.string().optional(),
  rtmp: z.boolean().optional(),
  rtmpAddress: z.string().default(':1935'),
  rtmpsAddress: z.string().optional(),
  hls: z.boolean().optional(),
  webrtc: z.boolean().optional(),
  webrtcAddress: z.string().default(':8889'),
  srt: z.boolean().optional(),
  srtAddress: z.string().optional(),
  paths: z.record(z.string(), pathConfigSchema).default({}),
});

export type PathConfig = z.infer<typeof pathConfigSchema>;
export type GlobalConfig = z.infer<typeof globalConfigSchema>;
