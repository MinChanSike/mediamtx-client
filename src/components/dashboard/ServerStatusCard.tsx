import {
  Badge,
  Card,
  Divider,
  MessageBar,
  MessageBarBody,
  Text,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useMediaMTXConfig } from '@src/hooks/useMediaMTXConfig';
import useAppStore from '@src/store/useAppStore';
import StatusBadge from '@src/components/common/StatusBadge';
import type { GlobalConfig } from '@src/types/config';
export { getApiAvailabilityStatus } from '@src/utils/apiAvailabilityStatus';
import { getApiAvailabilityStatus } from '@src/utils/apiAvailabilityStatus';

type ListenerStatus = 'enabled' | 'disabled' | 'unknown';

export interface ServerListenerRow {
  label: string;
  address?: string;
  status: ListenerStatus;
}

interface ProtocolRowProps {
  row: ServerListenerRow;
}

const LISTENER_DEFINITIONS: Array<{
  label: string;
  addressKey: keyof GlobalConfig;
  enabledKey?: keyof GlobalConfig;
}> = [
  { label: 'RTSP', addressKey: 'rtspAddress', enabledKey: 'rtsp' },
  { label: 'RTSPS', addressKey: 'rtspsAddress', enabledKey: 'rtsp' },
  { label: 'RTMP', addressKey: 'rtmpAddress', enabledKey: 'rtmp' },
  { label: 'RTMPS', addressKey: 'rtmpsAddress', enabledKey: 'rtmp' },
  { label: 'HLS', addressKey: 'hlsAddress', enabledKey: 'hls' },
  { label: 'WebRTC', addressKey: 'webrtcAddress', enabledKey: 'webrtc' },
  { label: 'SRT', addressKey: 'srtAddress', enabledKey: 'srt' },
  { label: 'API', addressKey: 'apiAddress', enabledKey: 'api' },
  { label: 'Metrics', addressKey: 'metricsAddress', enabledKey: 'metrics' },
  { label: 'PPROF', addressKey: 'pprofAddress', enabledKey: 'pprof' },
  { label: 'Playback', addressKey: 'playbackAddress', enabledKey: 'playback' },
];

function getListenerStatus(value: unknown): ListenerStatus {
  if (value === true) return 'enabled';
  if (value === false) return 'disabled';
  return 'unknown';
}

function getStringConfigValue(config: GlobalConfig, key: keyof GlobalConfig): string | undefined {
  const value = config[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export function getServerListenerRows(config: GlobalConfig): ServerListenerRow[] {
  return LISTENER_DEFINITIONS.map((definition) => {
    const address = getStringConfigValue(config, definition.addressKey);
    const status = definition.enabledKey
      ? getListenerStatus(config[definition.enabledKey])
      : 'unknown';

    return {
      label: definition.label,
      address,
      status,
    };
  }).filter((row) => row.address || row.status !== 'unknown');
}

const useStyles = makeStyles({
  card: {
    gap: tokens.spacingVerticalS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
  },
  title: {
    margin: 0,
  },
  endpoint: {
    overflowWrap: 'anywhere',
    color: tokens.colorNeutralForeground2,
  },
  protocolSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  sectionLabel: {
    color: tokens.colorNeutralForeground2,
  },
  protocolRows: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 0.7fr) minmax(100px, 1.4fr) minmax(90px, auto)',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXXS,
    alignItems: 'center',
  },
  protocolRow: {
    display: 'contents',
  },
  protocolValue: {
    minWidth: 0,
    overflowWrap: 'anywhere',
    color: tokens.colorNeutralForeground1,
  },
  protocolStatus: {
    justifySelf: 'start',
    minWidth: '50px',
  },
  protocolColumnHeader: {
    color: tokens.colorNeutralForeground3,
  },
});

const LISTENER_STATUS_BADGE: Record<
  ListenerStatus,
  { label: string; color: 'success' | 'danger' | 'subtle' }
> = {
  enabled: { label: 'Enabled', color: 'success' },
  disabled: { label: 'Disabled', color: 'danger' },
  unknown: { label: 'Unknown', color: 'subtle' },
};

export function ProtocolRow({ row }: ProtocolRowProps) {
  const styles = useStyles();
  const status = LISTENER_STATUS_BADGE[row.status];

  return (
    <div className={styles.protocolRow} role="row">
      <Text role="cell">{row.label}</Text>
      <Text role="cell" font="monospace" className={styles.protocolValue}>
        {row.address ?? '-'}
      </Text>
      <Badge
        role="cell"
        size="small"
        appearance="tint"
        color={status.color}
        className={styles.protocolStatus}
      >
        {status.label}
      </Badge>
    </div>
  );
}

export default function ServerStatusCard() {
  const styles = useStyles();
  const serverUrl = useAppStore((s) => s.serverUrl);
  const { data, isError, isPending } = useMediaMTXConfig();
  const status = getApiAvailabilityStatus({ isError, isPending });
  const listenerRows = data ? getServerListenerRows(data) : [];

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Title3 as="h2" className={styles.title}>
          Server Status
        </Title3>
        <StatusBadge status={status} />
      </div>

      <Text as="p" font="monospace" className={styles.endpoint}>
        {serverUrl}
      </Text>

      {data && (
        <div className={styles.protocolSection}>
          <Divider />
          <Text as="p" size={200} weight="semibold" className={styles.sectionLabel}>
            Protocols
          </Text>
          <div className={styles.protocolRows} role="table" aria-label="Protocol listeners">
            <div className={styles.protocolRow} role="row">
              <Text role="columnheader" size={200} className={styles.protocolColumnHeader}>
                Protocol
              </Text>
              <Text role="columnheader" size={200} className={styles.protocolColumnHeader}>
                Address
              </Text>
              <Text role="columnheader" size={200} className={styles.protocolColumnHeader}>
                Status
              </Text>
            </div>
            {listenerRows.map((row) => (
              <ProtocolRow key={row.label} row={row} />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <MessageBar intent="error">
          <MessageBarBody>Unable to connect to MediaMTX API</MessageBarBody>
        </MessageBar>
      )}
    </Card>
  );
}
