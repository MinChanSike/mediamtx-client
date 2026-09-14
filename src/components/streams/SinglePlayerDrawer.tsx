import {
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import CloseButton from '@src/components/common/CloseButton';
import usePlayerStore from '@src/store/usePlayerStore';
import VideoPlayer from '@src/components/streams/VideoPlayer';
import PlaybackUrls from '@src/components/streams/PlaybackUrls';
import type { PathItem } from '@src/types/stream';
import { getDisplayProtocol } from '@src/utils/streamDisplay';
import { usePathTransferRate } from '@src/hooks/useTransferRates';
import { formatByteRate } from '@src/utils/formatters';
import { UNAVAILABLE_RATE, type TransferRate } from '@src/utils/transferRates';

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
          <Text weight="semibold">Stream: {drawerStream?.name ?? 'Stream'}</Text>
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
