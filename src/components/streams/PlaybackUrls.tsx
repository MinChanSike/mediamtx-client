import { useState } from 'react';
import { Button, Input, Text, makeStyles, tokens } from '@fluentui/react-components';
import { Checkmark24Regular, Copy24Regular } from '@fluentui/react-icons';
import { useMediaMTXConfig } from '@src/hooks/useMediaMTXConfig';
import useAppStore from '@src/store/useAppStore';
import type { GlobalConfig } from '@src/types/config';

export type PlaybackUrlType = 'webrtc' | 'hls' | 'rtsp' | 'rtmp' | 'srt';

export interface PlaybackUrl {
  type: PlaybackUrlType;
  label: string;
  description: string;
  value: string;
}

type PlaybackUrlConfig = Pick<
  GlobalConfig,
  'webrtcAddress' | 'hlsAddress' | 'rtspAddress' | 'rtmpAddress' | 'srtAddress'
>;

interface PlaybackUrlsProps {
  streamName: string;
}

const useStyles = makeStyles({
  urlList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  urlRow: {
    paddingBlock: tokens.spacingVerticalXS,
  },
  urlHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
  },
  urlMeta: {
    minWidth: 0,
  },
  urlDescription: {
    color: tokens.colorNeutralForeground3,
  },
  urlInput: {
    width: '100%',
    marginTop: tokens.spacingVerticalXXS,
  },
});

export function extractPort(address: string | undefined, fallback: string) {
  if (!address) return fallback;
  const match = address.match(/:(\d+)$/);
  return match?.[1] ?? fallback;
}

export function buildPlaybackUrls(
  streamName: string,
  config: Partial<PlaybackUrlConfig> | null | undefined,
  serverUrl: string,
): PlaybackUrl[] {
  const webrtcPort = extractPort(config?.webrtcAddress, '8889');
  const hlsPort = extractPort(config?.hlsAddress, '8888');
  const rtspPort = extractPort(config?.rtspAddress, '8554');
  const rtmpPort = extractPort(config?.rtmpAddress, '1935');
  const srtPort = extractPort(config?.srtAddress, '8890');

  let hostname = 'localhost';
  let protocol = 'http:';
  try {
    const url = new URL(serverUrl);
    hostname = url.hostname;
    protocol = url.protocol;
  } catch {
    // Keep the default localhost URL parts if the configured server URL is invalid.
  }

  const whepUrl = `${protocol}//${hostname}:${webrtcPort}/${streamName}/whep`;
  const hlsUrl = `${protocol}//${hostname}:${hlsPort}/${streamName}/index.m3u8`;
  const rtspUrl = `rtsp://${hostname}:${rtspPort}/${streamName}`;
  const rtmpUrl = `rtmp://${hostname}:${rtmpPort}/${streamName}`;
  const srtUrl = `srt://${hostname}:${srtPort}?streamid=read:${streamName}`;

  return [
    {
      type: 'webrtc',
      label: 'WebRTC WHEP',
      description: 'Low latency browser playback',
      value: whepUrl,
    },
    { type: 'hls', label: 'HLS', description: 'High compatibility playback', value: hlsUrl },
    { type: 'rtsp', label: 'RTSP', description: 'Media player and NVR playback', value: rtspUrl },
    { type: 'rtmp', label: 'RTMP', description: 'RTMP client playback', value: rtmpUrl },
    { type: 'srt', label: 'SRT', description: 'SRT read stream ID playback', value: srtUrl },
  ];
}

export default function PlaybackUrls({ streamName }: PlaybackUrlsProps) {
  const styles = useStyles();
  const { data: config } = useMediaMTXConfig();
  const serverUrl = useAppStore((s) => s.serverUrl);
  const [copiedType, setCopiedType] = useState<PlaybackUrlType | null>(null);

  const copyToClipboard = (text: string, type: PlaybackUrlType) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2000);
    });
  };

  const playbackUrls = buildPlaybackUrls(streamName, config, serverUrl);

  return (
    <div className={styles.urlList}>
      {playbackUrls.map((playbackUrl) => (
        <div key={playbackUrl.type} className={styles.urlRow}>
          <div className={styles.urlHeader}>
            <div className={styles.urlMeta}>
              <Text size={200} weight="semibold" block>
                {playbackUrl.label}
              </Text>
              <Text size={200} className={styles.urlDescription}>
                {playbackUrl.description}
              </Text>
            </div>
            <Button
              appearance="subtle"
              icon={copiedType === playbackUrl.type ? <Checkmark24Regular /> : <Copy24Regular />}
              onClick={() => copyToClipboard(playbackUrl.value, playbackUrl.type)}
            >
              {copiedType === playbackUrl.type ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Input readOnly value={playbackUrl.value} className={styles.urlInput} />
        </div>
      ))}
    </div>
  );
}
