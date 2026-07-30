import humanizeDuration from 'humanize-duration';

/** Format bytes to human-readable string (e.g. 1.2 MB) */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** Format seconds as readable English uptime without displaying seconds. */
export function formatUptime(seconds: number): string {
  const wholeMinutes = Math.floor(seconds / 60);

  if (wholeMinutes < 1) return 'less than a minute';

  return humanizeDuration(wholeMinutes * 60_000, {
    language: 'en',
    units: ['d', 'h', 'm'],
    largest: 2,
    round: false,
  });
}

/** Format a protocol identifier to its display label */
export function formatProtocol(protocol: string): string {
  const map: Record<string, string> = {
    rtsp: 'RTSP',
    rtmp: 'RTMP',
    hls: 'HLS',
    webrtc: 'WebRTC',
    srt: 'SRT',
    udp: 'UDP',
    file: 'File',
    ffmpeg: 'FFmpeg',
  };
  return map[protocol.toLowerCase()] ?? protocol.toUpperCase();
}
