import { useState } from "react";
import MetricsFreshness from "@src/components/common/MetricsFreshness";
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
} from "@fluentui/react-components";
import PageHeader from "@src/components/common/PageHeader";
import StreamFilterBar from "@src/components/streams/StreamFilterBar";
import StreamTable from "@src/components/streams/StreamTable";
import StreamDetailsDrawer from "@src/components/streams/StreamDetailsDrawer";
import AddStreamDrawer from "@src/components/streams/AddStreamDrawer";
import SinglePlayerDrawer from "@src/components/streams/SinglePlayerDrawer";
import MultiPlayerGrid from "@src/components/streams/MultiPlayerGrid";
import EditStreamDrawer from "@src/components/streams/EditStreamDrawer";
import { useMediaMTXPaths } from "@src/hooks/useMediaMTXPaths";
import {
  getDisplayProtocol,
  getSourceKickTarget,
} from "@src/utils/streamDisplay";
import type { PathItem } from "@src/types/stream";
import usePlayerStore, { type StreamsView } from "@src/store/usePlayerStore";
import { useDeleteStream } from "@src/hooks/useDeleteStream";
import { resolveLatestDetailsStream } from "@src/utils/streamDetails";
import { useKickStreamTarget } from "@src/hooks/useKickStreamTarget";
import { useToggleStreamRecording } from "@src/hooks/useToggleStreamRecording";
import { isStreamRecordingEnabled } from "@src/utils/recordingStatus";

const useStyles = makeStyles({
  root: {
    display: "flex",
    height: "calc(100vh - 40px)",
    minHeight: 0,
    minWidth: 0,
    flexDirection: "column",
    overflow: "hidden",
  },
  toolbar: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    flexShrink: 0,
    borderRadius: tokens.borderRadiusSmall,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
  },
  toolbarFreshness: {
    position: "absolute",
    bottom: "0px",
    right: "22px",
  },
  content: {
    display: "flex",
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    flexDirection: "column",
    overflow: "hidden",
  },
  gridContent: {
    overflow: "hidden",
  },
  tableContent: {
    overflow: "hidden",
  },
});

export default function StreamsPage() {
  const styles = useStyles();
  const { data, isLoading, isError } = useMediaMTXPaths();
  const deleteMutation = useDeleteStream();
  const kickMutation = useKickStreamTarget();
  const recordingMutation = useToggleStreamRecording();

  const [search, setSearch] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("all");
  const [detailsStream, setDetailsStream] = useState<PathItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editStream, setEditStream] = useState<PathItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteStream, setDeleteStream] = useState<PathItem | null>(null);
  const [kickSourceStream, setKickSourceStream] = useState<PathItem | null>(
    null,
  );
  const [recordingStream, setRecordingStream] = useState<PathItem | null>(null);

  const layout = usePlayerStore((s) => s.streamsView);
  const setLayout = usePlayerStore((s) => s.setStreamsView);
  const gridLayout = usePlayerStore((s) => s.gridLayout);
  const setGridLayout = usePlayerStore((s) => s.setGridLayout);
  const activeGridStreams = usePlayerStore((s) => s.activeGridStreams);
  const setGridStream = usePlayerStore((s) => s.setGridStream);
  const setDrawerStream = usePlayerStore((s) => s.setDrawerStream);
  const setIsDrawerOpen = usePlayerStore((s) => s.setIsDrawerOpen);

  const streams = data?.items ?? [];
  const latestDetailsStream = resolveLatestDetailsStream(
    detailsStream,
    streams,
  );
  const latestKickSourceStream = resolveLatestDetailsStream(
    kickSourceStream,
    streams,
  );
  const latestRecordingStream = resolveLatestDetailsStream(
    recordingStream,
    streams,
  );
  const latestDeleteStream = resolveLatestDetailsStream(deleteStream, streams) ?? deleteStream;
  const deleteWillStopRecording = latestDeleteStream
    ? isStreamRecordingEnabled(latestDeleteStream)
    : false;
  const deleteWillKickSource = latestDeleteStream
    ? !!getSourceKickTarget(latestDeleteStream)
    : false;
  const deleteWillRemoveConfig = !!latestDeleteStream?.isConfigured;
  const deleteWillRemoveOrphanRuntimePath = !!latestDeleteStream && !deleteWillRemoveConfig && !deleteWillKickSource;
  const willStartRecording = latestRecordingStream
    ? !isStreamRecordingEnabled(latestRecordingStream)
    : false;
  const recordingActionLabel = willStartRecording
    ? "Start Recording"
    : "Stop Recording";

  const filteredStreams = streams
    .filter((stream) => {
      if (!search) return true;
      return stream.name.toLowerCase().includes(search.toLowerCase());
    })
    .filter((stream) => {
      if (protocolFilter === "all") return true;
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

  function handlePlay(stream: PathItem) {
    setDrawerStream(stream);
    setIsDrawerOpen(true);
  }

  function handleAddToGrid(stream: PathItem) {
    const slotCount =
      gridLayout === "1x1"
        ? 1
        : gridLayout === "2x2"
          ? 4
          : gridLayout === "3x3"
            ? 9
            : 16;

    let targetSlot = 0;
    for (let index = 0; index < slotCount; index++) {
      if (!activeGridStreams.has(index)) {
        targetSlot = index;
        break;
      }
    }
    setGridStream(targetSlot, stream.name);
    setLayout("grid");
  }

  const handleLayoutChange = (newLayout: StreamsView) => {
    setLayout(newLayout);
  };

  const handleGridLayoutChange = (
    newGridLayout: "1x1" | "2x2" | "3x3" | "4x4",
  ) => {
    setGridLayout(newGridLayout);
    setLayout("grid");
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
    if (!latestDeleteStream) return;

    deleteMutation.mutate(
      {
        pathName: latestDeleteStream.name,
        isConfigured: latestDeleteStream.isConfigured,
        isRecording: isStreamRecordingEnabled(latestDeleteStream),
        sourceKickTarget: getSourceKickTarget(latestDeleteStream),
      },
      {
        onSettled: () => setDeleteStream(null),
      },
    );
  }

  function handleKickSource(stream: PathItem) {
    setKickSourceStream(stream);
  }

  function handleConfirmKickSource() {
    const sourceKickTarget = latestKickSourceStream
      ? getSourceKickTarget(latestKickSourceStream)
      : null;
    if (!sourceKickTarget) return;

    kickMutation.mutate(sourceKickTarget, {
      onSettled: () => setKickSourceStream(null),
    });
  }

  function handleToggleRecording(stream: PathItem) {
    setRecordingStream(stream);
  }

  function handleConfirmToggleRecording() {
    if (!latestRecordingStream) return;

    recordingMutation.mutate(
      {
        pathName: latestRecordingStream.name,
        record: !isStreamRecordingEnabled(latestRecordingStream),
        isConfigured: latestRecordingStream.isConfigured,
        sourceUri: latestRecordingStream.source,
      },
      {
        onSettled: () => setRecordingStream(null),
      },
    );
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
          layout === "grid" && styles.gridContent,
          layout === "table" && styles.tableContent,
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
            {layout === "table" ? (
              <StreamTable
                streams={filteredStreams}
                onDetails={handleDetails}
                onPlay={handlePlay}
                onAddToGrid={handleAddToGrid}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onKickSource={handleKickSource}
                onToggleRecording={handleToggleRecording}
                recordingActionPending={recordingMutation.isPending}
              />
            ) : (
              <MultiPlayerGrid streams={filteredStreams} />
            )}
          </>
        )}
      </div>
      <MetricsFreshness className={styles.toolbarFreshness} />

      <StreamDetailsDrawer
        stream={latestDetailsStream}
        isOpen={isDetailsOpen}
        onClose={handleCloseDetails}
      />
      <AddStreamDrawer isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      <SinglePlayerDrawer />
      <EditStreamDrawer
        stream={editStream}
        isOpen={isEditOpen}
        onClose={handleCloseEdit}
      />

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
              {latestDeleteStream && (
                <div className="space-y-2">
                  <Text block>{`Delete stream "${latestDeleteStream.name}" from the server?`}</Text>
                  <Text block size={200}>
                    {deleteWillRemoveConfig
                      ? "Its path configuration will be removed."
                      : deleteWillRemoveOrphanRuntimePath
                        ? "This runtime-only path has no active source, so a temporary path configuration will be created and removed to clear it from the server."
                        : "This is an ad-hoc stream, so its active source will be kicked instead of deleting a path configuration."}
                  </Text>
                  {(deleteWillStopRecording || deleteWillKickSource) && (
                    <Text block size={200}>
                      {`This will ${[
                        deleteWillStopRecording ? "stop the active recording" : null,
                        deleteWillKickSource ? "kick the current source" : null,
                      ]
                        .filter(Boolean)
                        .join(" and ")}.`}
                    </Text>
                  )}
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteStream(null)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={deleteMutation.isPending}
                onClick={handleConfirmDelete}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        open={!!latestKickSourceStream}
        onOpenChange={(_, data) => {
          if (!data.open) setKickSourceStream(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Kick Source</DialogTitle>
            <DialogContent>
              {latestKickSourceStream && (
                <Text>{`Kick source for stream "${latestKickSourceStream.name}"?`}</Text>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setKickSourceStream(null)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={kickMutation.isPending}
                onClick={handleConfirmKickSource}
              >
                {kickMutation.isPending ? "Kicking..." : "Kick Source"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        open={!!latestRecordingStream}
        onOpenChange={(_, data) => {
          if (!data.open) setRecordingStream(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{recordingActionLabel}</DialogTitle>
            <DialogContent>
              {latestRecordingStream && (
                <Text>
                  {willStartRecording
                    ? `Start recording stream "${latestRecordingStream.name}"?`
                    : `Stop recording stream "${latestRecordingStream.name}"?`}
                </Text>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRecordingStream(null)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={recordingMutation.isPending}
                onClick={handleConfirmToggleRecording}
              >
                {recordingMutation.isPending
                  ? "Saving..."
                  : recordingActionLabel}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
