/** Detect the input protocol from a MediaMTX source URI string */
export function detectInputProtocol(source: string | null): string {
  if (!source) return 'unknown';
  const srcLower = source.toLowerCase();
  if (
    srcLower.startsWith('rtsp://') ||
    srcLower.startsWith('rtsps://') ||
    srcLower.startsWith('rtspsession') ||
    srcLower.startsWith('rtspssource') ||
    srcLower.startsWith('rtspconn') ||
    srcLower.startsWith('rtspssession')
  ) {
    return 'rtsp';
  }
  if (
    srcLower.startsWith('rtmp://') ||
    srcLower.startsWith('rtmps://') ||
    srcLower.startsWith('rtmpconn') ||
    srcLower.startsWith('rtmpsconn') ||
    srcLower.startsWith('rtmpsource')
  ) {
    return 'rtmp';
  }
  if (
    srcLower.startsWith('srt://') ||
    srcLower.startsWith('srtconn') ||
    srcLower.startsWith('srtsource')
  ) {
    return 'srt';
  }
  if (srcLower.startsWith('udp://')) {
    return 'udp';
  }
  if (
    srcLower.startsWith('http://') ||
    srcLower.startsWith('https://') ||
    srcLower.startsWith('hlssession') ||
    srcLower.startsWith('hlssource')
  ) {
    return 'hls';
  }
  if (srcLower.startsWith('ffmpeg:')) {
    return 'ffmpeg';
  }
  if (srcLower.startsWith('/') || srcLower.match(/^[a-z]:\\/)) {
    return 'file';
  }
  return 'unknown';
}

/** Check whether the browser supports WebRTC WHEP */
export function supportsWebRTC(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}
