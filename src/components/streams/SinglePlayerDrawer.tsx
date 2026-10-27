import {
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { CircleFilled, Video16Filled } from '@fluentui/react-icons';
import CloseButton from '@src/components/common/CloseButton';
import usePlayerStore from '@src/store/usePlayerStore';
import VideoPlayer from '@src/components/streams/VideoPlayer';
import PlaybackUrls from '@src/components/streams/PlaybackUrls';
import type { PathItem } from '@src/types/stream';
import { getDisplayProtocol } from '@src/utils/streamDisplay';
import { usePathTransferRate } from '@src/hooks/useTransferRates';
import { formatByteRate } from '@src/utils/formatters';
import { UNAVAILABLE_RATE, type TransferRate } from '@src/utils/transferRates';
import { isStreamRecordingEnabled } from '@src/utils/recordingStatus';

const useStyles = makeStyles({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  player: {
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: tokens.borderRadiusNone,
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalS,
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  metricItem: {
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  metricLabel: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
  },
  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  cameraIcon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
    color: tokens.colorNeutralForeground3,
  },
  onlineCameraIcon: {
    color: tokens.colorPaletteLightGreenForeground3,
  },
  cameraIconWrapper: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  cameraRecordingDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '6px',
    width: '6px',
    height: '6px',
    color: '#d13438',
    animationName: {
      from: { opacity: 1 },
      '50%': { opacity: 0.25 },
      to: { opacity: 1 },
    },
    animationDuration: '1.2s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
    pointerEvents: 'none',
  },
  recordingIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
  },
  recordingDot: {
    width: '8px',
    height: '8px',
    flexShrink: 0,
    color: '#d13438',
    animationName: {
      from: { opacity: 1 },
      '50%': { opacity: 0.25 },
      to: { opacity: 1 },
    },
    animationDuration: '1.2s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  },
  recordingText: {
    color: '#d13438',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase100,
  },
});

export function getSinglePlayerMetrics(stream: PathItem, rate: TransferRate = UNAVAILABLE_RATE) {
  return [
    { label: 'Protocol', value: getDisplayProtocol(stream).toUpperCase() },
    { label: 'Track Count', value: String(stream.tracks.length) },
    {
      label: 'Ingress',
      value: formatByteRate(rate.inboundBytesPerSecond),
    },
    { label: 'Egress', value: formatByteRate(rate.outboundBytesPerSecond) },
    { label: 'Total Readers', value: String(stream.readers.length) },
  ];
}

export default function SinglePlayerDrawer() {
  const styles = useStyles();
  const drawerStream = usePlayerStore((s) => s.drawerStream);
  const rate = usePathTransferRate(drawerStream?.name);
  const isDrawerOpen = usePlayerStore((s) => s.isDrawerOpen);
  const setIsDrawerOpen = usePlayerStore((s) => s.setIsDrawerOpen);
  const isRecording = drawerStream ? isStreamRecordingEnabled(drawerStream) : false;

  const handleClose = () => {
    setIsDrawerOpen(false);
  };

  return (
    <OverlayDrawer
      open={isDrawerOpen && !!drawerStream}
      position="end"
      size="medium"
      onOpenChange={(_, data) => {
        if (!data.open) handleClose();
      }}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <CloseButton
              aria-label="Close player"
              onClick={handleClose}
            />
          }
        >
          <div className={styles.titleWrapper}>
            <span className={styles.cameraIconWrapper}>
              <Video16Filled className={styles.onlineCameraIcon} />
              {isRecording && (
                <CircleFilled
                  className={styles.cameraRecordingDot}
                  aria-hidden="true"
                />
              )}
            </span>
            <Text weight="semibold">Stream: {drawerStream?.name ?? 'Stream'}</Text>
            {isRecording && (
              <span
                className={styles.recordingIndicator}
                title="Recording"
                aria-label="Recording"
              >
                <CircleFilled className={styles.recordingDot} />
                <span className={styles.recordingText}>REC</span>
              </span>
            )}
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>

      {drawerStream && (
        <DrawerBody>
          <div className={styles.body}>
            <VideoPlayer streamName={drawerStream.name} className={styles.player} />

            <div className={styles.metrics}>
              {getSinglePlayerMetrics(drawerStream, rate)
                .filter((metric) => metric.label === 'Ingress' || metric.label === 'Egress')
                .map((metric) => (
                  <div key={metric.label} className={styles.metricItem}>
                    <Text size={200} className={styles.metricLabel}>
                      {metric.label}
                    </Text>
                    <Text block font="monospace">
                      {metric.value}
                    </Text>
                  </div>
                ))}
            </div>

            <Text weight="semibold" className="mt-3">
              Playback URLs
            </Text>
            <PlaybackUrls streamName={drawerStream.name} />
          </div>
        </DrawerBody>
      )}
    </OverlayDrawer>
  );
}
