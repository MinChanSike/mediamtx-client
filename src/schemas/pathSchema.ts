import { z } from 'zod';

export const trackSchema = z.object({
  id: z.number(),
  type: z.string(),
}).passthrough();

export const readerSchema = z.object({
  id: z.string().default(''),
  type: z.string().default(''),
  state: z.string().default(''),
  remoteAddr: z.string().optional(),
  ip: z.string().optional(),
  protocol: z.string().optional(),
  created: z.string().optional(),
  startTime: z.string().optional(),
  startedAt: z.string().optional(),
}).passthrough();

export const pathItemSchema = z.object({
  name: z.string(),
  source: z.string().nullable(),
  sourceInfo: z.record(z.unknown()).nullable().optional(),
  sourceState: z.string().optional(),
  sourceError: z.string(),
  online: z.boolean().optional(),
  available: z.boolean().optional(),
  ready: z.boolean().optional(),
  tracks: z.array(trackSchema),
  bytesReceived: z.number(),
  bytesSent: z.number(),
  inboundBytes: z.number().optional(),
  outboundBytes: z.number().optional(),
  totalBytesReceived: z.number().optional(),
  totalBytesSent: z.number().optional(),
  readers: z.array(readerSchema),
  isConfigured: z.boolean().optional(),
}).passthrough();

export const pathListSchema = z.object({
  itemCount: z.number(),
  pageCount: z.number(),
  items: z.array(pathItemSchema),
});

export type PathItem = z.infer<typeof pathItemSchema>;
export type PathList = z.infer<typeof pathListSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Reader = z.infer<typeof readerSchema>;
