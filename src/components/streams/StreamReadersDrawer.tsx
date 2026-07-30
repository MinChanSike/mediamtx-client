import { useEffect, useState } from 'react';
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
import type { PathItem } from '@src/types/stream';
import type { ViewerDetailTarget } from '@src/utils/streamDisplay';
import type { ViewerTableRow } from '@src/utils/streamDetails';
import StreamReaderList from '@src/components/streams/StreamReaderList';
import ViewerDetailsDrawer from '@src/components/streams/ViewerDetailsDrawer';

interface StreamReadersDrawerProps {
  stream: PathItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const useStyles = makeStyles({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  streamName: {
    overflowWrap: 'anywhere',
  },
});

export default function StreamReadersDrawer({ stream, isOpen, onClose }: StreamReadersDrawerProps) {
  const styles = useStyles();
  const closeButtonStyles = useCloseButtonStyles();
  const [selectedViewerTarget, setSelectedViewerTarget] = useState<ViewerDetailTarget | null>(null);

  useEffect(() => {
    setSelectedViewerTarget(null);
  }, [stream?.name, isOpen]);

  function handleSelectViewer(row: ViewerTableRow) {
    if (!row.detailTarget) return;
    setSelectedViewerTarget(row.detailTarget);
  }

  return (
    <>
      <OverlayDrawer
        open={isOpen && !!stream}
        position="end"
        style={{ width: 420 }}
        onOpenChange={(_, data) => {
          if (!data.open) onClose();
        }}
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                aria-label="Close readers"
                className={closeButtonStyles.dangerHover}
                icon={<Dismiss24Regular />}
                onClick={onClose}
              />
            }
          >
            Active Readers
          </DrawerHeaderTitle>
        </DrawerHeader>

        {stream && (
          <DrawerBody>
            <div className={styles.body}>
              <Text font="monospace" weight="semibold" className={styles.streamName}>
                {stream.name}
              </Text>
              <StreamReaderList readers={stream.readers} onSelectViewer={handleSelectViewer} />
            </div>
          </DrawerBody>
        )}
      </OverlayDrawer>

      <ViewerDetailsDrawer
        viewerTarget={selectedViewerTarget}
        isOpen={isOpen && !!stream && !!selectedViewerTarget}
        onClose={() => setSelectedViewerTarget(null)}
      />
    </>
  );
}
