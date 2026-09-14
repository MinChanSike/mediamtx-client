import { useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import {
  Button,
  Input,
  Spinner,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  ArrowClockwise16Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  Search16Regular,
  VideoClipFilled,
  VideoClipOffFilled,
  VideoOff16Regular,
} from "@fluentui/react-icons";
import type { Recording } from "@src/schemas/recordingSchema";
import { createPlaybackSyncAssignmentDragData } from "@src/components/playbackSync/playbackSyncDragData";

interface PlaybackRecordingSidebarProps {
  recordings: Recording[];
  assignedPaths: Set<string>;
  selectedDay: string;
  isLoading: boolean;
  onAssign: (path: string) => void;
  onRefresh: () => void;
  onDayChange: (day: string) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
}

const useStyles = makeStyles({
  root: {
    boxSizing: "border-box",
    display: "flex",
    width: "220px",
    minWidth: "220px",
    height: "100%",
    minHeight: 0,
    flexDirection: "column",
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    "@media (max-width: 760px)": {
      width: "184px",
      minWidth: "184px",
    },
  },
  header: {
    display: "flex",
    minHeight: "44px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    paddingLeft: tokens.spacingHorizontalS,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
  },
  refreshButton: {
    minWidth: "32px",
    width: "32px",
  },
  search: {
    flexShrink: 0,
    margin: tokens.spacingHorizontalXS,
    marginBottom: 0,
  },
  list: {
    minHeight: 0,
    flex: 1,
    overflowY: "auto",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXS}`,
  },
  recordingButton: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    minHeight: "56px",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalS,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    textAlign: "left",
    cursor: "grab",
  },
  draggingRecordingButton: {
    cursor: "grabbing",
    opacity: 0.45,
  },
  recordingIcon: {
    flexShrink: 0,
    color: tokens.colorNeutralForeground3,
  },
  recordingIconAvailable: {
    color: tokens.colorPaletteLightGreenForeground3,
  },
  recordingCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  recordingName: {
    display: "block",
    maxWidth: "100%",
    fontFamily: tokens.fontFamilyMonospace,
    lineHeight: tokens.lineHeightBase200,
  },
  recordingMeta: {
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase100,
  },
  recordingMetaUnavailable: {
    color: tokens.colorNeutralForeground3,
  },
  empty: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
  },
  calendar: {
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
  },
  dateRow: {
    display: "grid",
    gridTemplateColumns: "32px minmax(0, 1fr) 32px",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
  },
  dateButton: {
    minWidth: "32px",
    width: "32px",
  },
  dateInput: {
    minWidth: 0,
    width: "100%",
    "& input": {
      minWidth: 0,
    },
  },
});

export function hasRecordingOnDay(
  recording: Recording,
  selectedDay: string,
): boolean {
  return recording.segments.some((segment) => {
    const start = Date.parse(segment.start);
    if (Number.isNaN(start)) return false;
    const date = new Date(start);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}` === selectedDay;
  });
}

function recordingDayLabel(selectedDay: string, isAvailable: boolean): string {
  const date = new Date(`${selectedDay}T00:00:00`).toLocaleDateString();
  return `${isAvailable ? "Recorded" : "No recorded"} ${date}`;
}

interface RegisterRecordingDraggableOptions {
  element: ElementRef<"button">;
  recordingName: string;
  setIsDragging: (isDragging: boolean) => void;
}

export function registerRecordingDraggable(
  { element, recordingName, setIsDragging }: RegisterRecordingDraggableOptions,
  register: typeof draggable = draggable,
) {
  return register({
    element,
    getInitialData: () => createPlaybackSyncAssignmentDragData(recordingName),
    onDragStart: () => setIsDragging(true),
    onDrop: () => setIsDragging(false),
  });
}

interface RecordingListItemProps {
  recording: Recording;
  isAssigned: boolean;
  isAvailable: boolean;
  selectedDay: string;
  onAssign: (path: string) => void;
}

function RecordingListItem({
  recording,
  isAssigned,
  isAvailable,
  selectedDay,
  onAssign,
}: RecordingListItemProps) {
  const styles = useStyles();
  const elementRef = useRef<ElementRef<"button">>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    return registerRecordingDraggable({
      element,
      recordingName: recording.name,
      setIsDragging,
    });
  }, [recording.name]);

  return (
    <Button
      ref={elementRef}
      className={mergeClasses(
        styles.recordingButton,
        isDragging && styles.draggingRecordingButton,
      )}
      appearance={isAssigned ? "secondary" : "subtle"}
      aria-disabled={isAssigned}
      onClick={() => {
        if (!isAssigned) onAssign(recording.name);
      }}
      aria-label={`${isAssigned ? "Assigned" : "Assign"} ${recording.name}`}
    >
      {isAvailable ? (
        <VideoClipFilled
          className={mergeClasses(
            styles.recordingIcon,
            styles.recordingIconAvailable,
          )}
        />
      ) : (
        <VideoClipOffFilled className={styles.recordingIcon} />
      )}
      <span className={styles.recordingCopy}>
        <Text className={styles.recordingName} truncate>
          {recording.name}
        </Text>
        <Text
          className={mergeClasses(
            styles.recordingMeta,
            !isAvailable && styles.recordingMetaUnavailable,
          )}
          size={200}
          truncate
        >
          {recordingDayLabel(selectedDay, isAvailable)}
        </Text>
      </span>
    </Button>
  );
}

export default function PlaybackSyncRecordingSidebar({
  recordings,
  assignedPaths,
  selectedDay,
  isLoading,
  onAssign,
  onRefresh,
  onDayChange,
  onPreviousDay,
  onNextDay,
}: PlaybackRecordingSidebarProps) {
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const visibleRecordings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sorted = [...recordings].sort((a, b) => a.name.localeCompare(b.name));
    return normalizedQuery
      ? sorted.filter((recording) =>
          recording.name.toLowerCase().includes(normalizedQuery),
        )
      : sorted;
  }, [recordings, query]);

  return (
    <aside className={styles.root} aria-label="Recorded streams">
      <div className={styles.header}>
        <Text weight="semibold">Streams</Text>
        <div className={styles.headerActions}>
          <Tooltip content="Filter streams" relationship="label">
            <Button
              className={styles.refreshButton}
              appearance={isSearchVisible ? "secondary" : "subtle"}
              icon={<Search16Regular />}
              aria-label="Toggle stream filter"
              onClick={() => {
                setIsSearchVisible((visible) => !visible);
                if (isSearchVisible) setQuery("");
              }}
            />
          </Tooltip>
          <Tooltip content="Refresh recordings" relationship="label">
            <Button
              className={styles.refreshButton}
              appearance="subtle"
              icon={<ArrowClockwise16Regular />}
              aria-label="Refresh recordings catalog"
              disabled={isLoading}
              onClick={onRefresh}
            />
          </Tooltip>
        </div>
      </div>

      {isSearchVisible && (
        <Input
          className={styles.search}
          value={query}
          onChange={(_event, data) => setQuery(data.value)}
          placeholder="Filter streams"
          aria-label="Filter recorded streams"
          autoFocus
        />
      )}

      <div className={styles.list}>
        {isLoading ? (
          <div className={styles.empty}>
            <Spinner size="extra-small" />
            <Text size={100}>Loading recordings…</Text>
          </div>
        ) : visibleRecordings.length === 0 ? (
          <div className={styles.empty}>
            <VideoOff16Regular />
            <Text size={100}>
              {recordings.length === 0
                ? "No recorded streams"
                : "No matching streams"}
            </Text>
          </div>
        ) : (
          visibleRecordings.map((recording) => (
            <RecordingListItem
              key={recording.name}
              recording={recording}
              isAssigned={assignedPaths.has(recording.name)}
              isAvailable={hasRecordingOnDay(recording, selectedDay)}
              selectedDay={selectedDay}
              onAssign={onAssign}
            />
          ))
        )}
      </div>

      <div className={styles.calendar}>
        <div className={styles.dateRow}>
          <Button
            className={styles.dateButton}
            appearance="subtle"
            icon={<ChevronLeft16Regular />}
            aria-label="Previous day"
            onClick={onPreviousDay}
          />
          <Input
            className={styles.dateInput}
            type="date"
            value={selectedDay}
            onChange={(_event, data) => data.value && onDayChange(data.value)}
            aria-label="Timeline day"
          />
          <Button
            className={styles.dateButton}
            appearance="subtle"
            icon={<ChevronRight16Regular />}
            aria-label="Next day"
            onClick={onNextDay}
          />
        </div>
      </div>
    </aside>
  );
}
