import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import PageHeader from '@src/components/common/PageHeader';
import StreamFilterBar from '@src/components/streams/StreamFilterBar';
import StreamTable from '@src/components/streams/StreamTable';
import StreamCard from '@src/components/streams/StreamCard';
import StreamDetailsDrawer from '@src/components/streams/StreamDetailsDrawer';
import StreamReadersDrawer from '@src/components/streams/StreamReadersDrawer';
import AddStreamDrawer from '@src/components/streams/AddStreamDrawer';
import SinglePlayerDrawer from '@src/components/streams/SinglePlayerDrawer';
import MultiPlayerGrid from '@src/components/streams/MultiPlayerGrid';
import EditStreamDrawer from '@src/components/streams/EditStreamDrawer';
import { useMediaMTXPaths } from '@src/hooks/useMediaMTXPaths';
import { getDisplayProtocol } from '@src/utils/streamDisplay';
import type { PathItem } from '@src/types/stream';
import usePlayerStore, { type StreamsView } from '@src/store/usePlayerStore';
import { useDeleteStream } from '@src/hooks/useDeleteStream';
import { resolveLatestDetailsStream } from '@src/utils/streamDetails';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    height: 'calc(100vh - 40px)',
    minHeight: 0,
    minWidth: 0,
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    overflow: 'hidden',
  },
  toolbar: {
    flexShrink: 0,
    borderRadius: tokens.borderRadiusSmall,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalS,
  },
  content: {
    display: 'flex',
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  gridContent: {
    overflow: 'hidden',
  },
  tableContent: {
    overflow: 'hidden',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalM,
    overflow: 'auto',
    '@media (max-width: 1280px)': {
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    },
    '@media (max-width: 960px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '@media (max-width: 640px)': {
      gridTemplateColumns: '1fr',
    },
  },
  emptyCards: {
    color: tokens.colorNeutralForeground3,
  },
});

export default function StreamsPage() {
  const styles = useStyles();
  const { data, isLoading, isError } = useMediaMTXPaths();
  const deleteMutation = useDeleteStream();

  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [detailsStream, setDetailsStream] = useState<PathItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewerDrawerStream, setViewerDrawerStream] = useState<PathItem | null>(null);
  const [isViewerDrawerOpen, setIsViewerDrawerOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editStream, setEditStream] = useState<PathItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteStream, setDeleteStream] = useState<PathItem | null>(null);

  const layout = usePlayerStore((s) => s.streamsView);
  const setLayout = usePlayerStore((s) => s.setStreamsView);
  const gridLayout = usePlayerStore((s) => s.gridLayout);
  const setGridLayout = usePlayerStore((s) => s.setGridLayout);
  const activeGridStreams = usePlayerStore((s) => s.activeGridStreams);
  const setGridStream = usePlayerStore((s) => s.setGridStream);
  const setDrawerStream = usePlayerStore((s) => s.setDrawerStream);
  const setIsDrawerOpen = usePlayerStore((s) => s.setIsDrawerOpen);

  const streams = data?.items ?? [];
  const latestDetailsStream = resolveLatestDetailsStream(detailsStream, streams);
  const latestViewerDrawerStream = resolveLatestDetailsStream(viewerDrawerStream, streams);

  const filteredStreams = streams
    .filter((stream) => {
      if (!search) return true;
      return stream.name.toLowerCase().includes(search.toLowerCase());
    })
    .filter((stream) => {
      if (protocolFilter === 'all') return true;
      return getDisplayProtocol(stream) === protocolFilter;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleDetails(stream: PathItem) {
    setDetailsStream(stream);
    setIsDetailsOpen(true);
  }

  function handleCloseDetails() {
    setIsDetailsOpen(false);
    setDetailsStream(null);
  }

  function handleViewers(stream: PathItem) {
    setViewerDrawerStream(stream);
    setIsViewerDrawerOpen(true);
  }

  function handleCloseViewers() {
    setIsViewerDrawerOpen(false);
    setViewerDrawerStream(null);
  }

  function handlePlay(stream: PathItem) {
    setDrawerStream(stream);
    setIsDrawerOpen(true);
  }

  function handleAddToGrid(stream: PathItem) {
    const slotCount =
      gridLayout === '1x1' ? 1 : gridLayout === '2x2' ? 4 : gridLayout === '3x3' ? 9 : 16;

    let targetSlot = 0;
    for (let index = 0; index < slotCount; index++) {
      if (!activeGridStreams.has(index)) {
        targetSlot = index;
        break;
      }
    }
    setGridStream(targetSlot, stream.name);
    setLayout('grid');
  }

  const handleLayoutChange = (newLayout: StreamsView) => {
    setLayout(newLayout);
  };

  const handleGridLayoutChange = (newGridLayout: '1x1' | '2x2' | '3x3' | '4x4') => {
    setGridLayout(newGridLayout);
    setLayout('grid');
  };

  function handleEdit(stream: PathItem) {
    setEditStream(stream);
    setIsEditOpen(true);
  }

  function handleCloseEdit() {
    setIsEditOpen(false);
    setEditStream(null);
  }

  function handleDelete(stream: PathItem) {
    setDeleteStream(stream);
  }

  function handleConfirmDelete() {
    if (!deleteStream) return;
    deleteMutation.mutate(deleteStream.name, {
      onSettled: () => setDeleteStream(null),
    });
  }

  function handleCardDelete(stream: PathItem) {
    deleteMutation.mutate(stream.name);
  }

  return (
    <div className={styles.root}>
      <PageHeader
        title="Streams"
        subtitle="Active Stream status and configured streams on the MediaMTX server"
      />

      <div className={styles.toolbar}>
        <StreamFilterBar
          search={search}
          onSearchChange={setSearch}
          protocol={protocolFilter}
          onProtocolChange={setProtocolFilter}
          layout={layout}
          onLayoutChange={handleLayoutChange}
          gridLayout={gridLayout}
          onGridLayoutChange={handleGridLayoutChange}
          onAddStream={() => setIsAddOpen(true)}
        />
      </div>

      <div
        className={mergeClasses(
          styles.content,
          layout === 'grid' && styles.gridContent,
          layout === 'table' && styles.tableContent
        )}
      >
        {isLoading && <Spinner label="Loading streams..." />}
        {isError && (
          <MessageBar intent="error">
            <MessageBarBody>
              Unable to load streams. Check that MediaMTX API is reachable.
            </MessageBarBody>
          </MessageBar>
        )}

        {!isLoading && !isError && (
          <>
            {layout === 'table' ? (
              <StreamTable
                streams={filteredStreams}
                onDetails={handleDetails}
                onPlay={handlePlay}
                onAddToGrid={handleAddToGrid}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ) : layout === 'cards' ? (
              <div className={styles.cardsGrid}>
                {filteredStreams.length === 0 ? (
                  <Text as="p" className={styles.emptyCards}>
                    No streams found
                  </Text>
                ) : (
                  filteredStreams.map((stream) => (
                    <StreamCard
                      key={stream.name}
                      stream={stream}
                      onDetails={handleDetails}
                      onPlay={handlePlay}
                      onAddToGrid={handleAddToGrid}
                      onEdit={handleEdit}
                      onDelete={handleCardDelete}
                      onViewers={handleViewers}
                    />
                  ))
                )}
              </div>
            ) : (
              <MultiPlayerGrid streams={filteredStreams} />
            )}
          </>
        )}
      </div>

      <StreamDetailsDrawer
        stream={latestDetailsStream}
        isOpen={isDetailsOpen}
        onClose={handleCloseDetails}
      />
      <StreamReadersDrawer
        stream={latestViewerDrawerStream}
        isOpen={isViewerDrawerOpen}
        onClose={handleCloseViewers}
      />
      <AddStreamDrawer isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      <SinglePlayerDrawer />
      <EditStreamDrawer stream={editStream} isOpen={isEditOpen} onClose={handleCloseEdit} />
      <Dialog
        open={!!deleteStream}
        onOpenChange={(_, data) => {
          if (!data.open) setDeleteStream(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Stream</DialogTitle>
            <DialogContent>
              {deleteStream && (
                <Text>{`Are you sure you want to delete stream "${deleteStream.name}"?`}</Text>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteStream(null)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={deleteMutation.isPending}
                onClick={handleConfirmDelete}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
