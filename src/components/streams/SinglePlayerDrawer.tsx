import {
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import useCloseButtonStyles from '@src/components/common/useCloseButtonStyles';
import usePlayerStore from '@src/store/usePlayerStore';
import VideoPlayer from '@src/components/streams/VideoPlayer';
import PlaybackUrls from '@src/components/streams/PlaybackUrls';
import type { PathItem } from '@src/types/stream';
import { getDisplayProtocol } from '@src/utils/streamDisplay';

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
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalS,
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  metricItem: {
    minWidth: 0,
  },
  metricLabel: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
  },
});

export function getSinglePlayerMetrics(stream: PathItem) {
  const inboundBytes = stream.inboundBytes ?? stream.bytesReceived;
  const outboundBytes = stream.outboundBytes ?? stream.bytesSent;

  return [
    { label: 'Protocol', value: getDisplayProtocol(stream).toUpperCase() },
    { label: 'Track Count', value: String(stream.tracks.length) },
    {
      label: 'Bytes In/Out',
      value: `${inboundBytes.toLocaleString()} / ${outboundBytes.toLocaleString()}`,
    },
    { label: 'Total Readers', value: String(stream.readers.length) },
  ];
}

export default function SinglePlayerDrawer() {
  const styles = useStyles();
  const closeButtonStyles = useCloseButtonStyles();
  const drawerStream = usePlayerStore((s) => s.drawerStream);
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
            <Button
              appearance="subtle"
              aria-label="Close player"
              className={closeButtonStyles.dangerHover}
              icon={<Dismiss24Regular />}
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
