export interface PathItem {
  name: string;
  source: string | null;
  sourceInfo?: Record<string, unknown> | null;
  sourceState?: string;
  sourceError: string;
  online?: boolean;
  available?: boolean;
  ready?: boolean;
  tracks: Track[];
  bytesReceived: number;
  bytesSent: number;
  inboundBytes?: number;
  outboundBytes?: number;
  totalBytesReceived?: number;
  totalBytesSent?: number;
  readers: Reader[];
  isConfigured?: boolean;
  [key: string]: unknown;
}

export type Track = string;

export interface Reader {
  id: string;
  type: string;
  state: string;
  remoteAddr?: string;
  ip?: string;
  protocol?: string;
  created?: string;
  startTime?: string;
  startedAt?: string;
  [key: string]: unknown;
}
