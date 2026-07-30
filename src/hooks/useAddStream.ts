import { z } from 'zod';
import { runAddStreamMutation, useStoreMutation } from '@src/hooks/useMediaMTXApi';

export const ADD_STREAM_PROTOCOLS = [
  { value: 'rtsp', label: 'RTSP', placeholder: 'rtsp://camera:554/stream' },
  { value: 'rtsps', label: 'RTSPS', placeholder: 'rtsps://camera:554/stream' },
  { value: 'rtmp', label: 'RTMP', placeholder: 'rtmp://server:1935/stream' },
  { value: 'rtmps', label: 'RTMPS', placeholder: 'rtmps://server:1935/stream' },
  { value: 'hls', label: 'HLS', placeholder: 'http://server:8080/stream.m3u8' },
  { value: 'srt', label: 'SRT', placeholder: 'srt://server:9000?streamid=stream' },
  { value: 'whep', label: 'WHEP', placeholder: 'whep://server:8889/stream/whep' },
] as const;

export const addStreamProtocolSchema = z.enum([
  'rtsp',
  'rtsps',
  'rtmp',
  'rtmps',
  'hls',
  'srt',
  'whep',
]);

export type AddStreamProtocol = z.infer<typeof addStreamProtocolSchema>;

export const ADD_STREAM_PLACEHOLDERS: Record<AddStreamProtocol, string> = ADD_STREAM_PROTOCOLS.reduce(
  (placeholders, protocol) => ({ ...placeholders, [protocol.value]: protocol.placeholder }),
  {} as Record<AddStreamProtocol, string>
);

export function detectAddStreamProtocol(source: string): AddStreamProtocol | null {
  const sourceLower = source.trim().toLowerCase();
  if (sourceLower.startsWith('rtsps://')) return 'rtsps';
  if (sourceLower.startsWith('rtsp://')) return 'rtsp';
  if (sourceLower.startsWith('rtmps://')) return 'rtmps';
  if (sourceLower.startsWith('rtmp://')) return 'rtmp';
  if (sourceLower.startsWith('srt://')) return 'srt';
  if (sourceLower.startsWith('whep://')) return 'whep';
  if (sourceLower.startsWith('http://') || sourceLower.startsWith('https://')) return 'hls';
  return null;
}

function parseUri(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hasHostPortAndPath(url: URL) {
  return Boolean(url.hostname && url.port && url.pathname.length > 1);
}

export function isValidAddStreamSourceUri(protocol: AddStreamProtocol, sourceUri: string) {
  const url = parseUri(sourceUri);
  if (!url) return false;

  switch (protocol) {
    case 'rtsp':
    case 'rtsps':
    case 'rtmp':
    case 'rtmps':
    case 'whep':
      return url.protocol === `${protocol}:` && hasHostPortAndPath(url);
    case 'hls':
      return (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        Boolean(url.hostname) &&
        url.pathname.toLowerCase().endsWith('.m3u8')
      );
    case 'srt':
      return url.protocol === 'srt:' && Boolean(url.hostname && url.port && url.searchParams.get('streamid'));
  }
}

export const addStreamSchema = z.object({
  pathName: z
    .string()
    .min(1, 'Stream name is required')
    .regex(/^[a-zA-Z0-9_\-/]+$/, 'Only letters, numbers, _, -, / are allowed'),
  protocol: addStreamProtocolSchema,
  sourceUri: z.string().min(1, 'Source URI is required'),
}).superRefine((value, context) => {
  if (!value.sourceUri || isValidAddStreamSourceUri(value.protocol, value.sourceUri)) return;

  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['sourceUri'],
    message: `Source URI must match ${value.protocol.toUpperCase()} format, for example ${ADD_STREAM_PLACEHOLDERS[value.protocol]}`,
  });
});

export type AddStreamInput = z.infer<typeof addStreamSchema>;

export function useAddStream() {
  return useStoreMutation('addStream', runAddStreamMutation);
}
