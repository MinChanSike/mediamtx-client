import { useEffect, useMemo, useRef, useState, type ElementRef, type ReactNode } from 'react';
import { Button, Text, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
  ChevronRight16Regular,
  CircleFilled,
  DismissRegular,
  Folder16Regular,
  VideoOff16Regular,
  Video16Filled,
} from '@fluentui/react-icons';
import usePlayerStore from '@src/store/usePlayerStore';
import type { PathItem } from '@src/types/stream';
import VideoPlayer from '@src/components/streams/VideoPlayer';
import useCloseButtonStyles from '@src/components/common/useCloseButtonStyles';
import { isStreamOnline } from '@src/utils/streamStatus';
import { buildStreamTree, type StreamTreeNode } from '@src/components/streams/streamTree';
import {
  assignDroppedStream,
  createStreamAssignmentDragData,
  isStreamAssignmentDragData,
} from '@src/components/streams/streamDragData';

interface MultiPlayerGridProps {
  streams: PathItem[];
}

const GRID_DETAILS = {
  '1x1': { slotCount: 1, columns: 1 },
  '2x2': { slotCount: 4, columns: 2 },
  '3x3': { slotCount: 9, columns: 3 },
  '4x4': { slotCount: 16, columns: 4 },
} as const;

const useStyles = makeStyles({
  root: {
    display: 'flex',
    width: '100%',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground1,
    '@media (max-width: 900px)': {
      flexDirection: 'column',
    },
  },
  sidebar: {
    display: 'flex',
    width: '220px',
    flexShrink: 0,
    flexDirection: 'column',
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground2,
    '@media (max-width: 900px)': {
      width: '100%',
      maxHeight: '180px',
      borderRightWidth: 0,
      borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    },
  },
  sidebarHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    flexShrink: 0,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
  },
  sidebarTitle: {
    display: 'block',
  },
  sidebarHint: {
    display: 'block',
    marginTop: 0,
    marginBottom: 0,
    color: tokens.colorNeutralForeground3,
  },
  streamList: {
    minHeight: 0,
    flex: 1,
    overflowY: 'auto',
    padding: tokens.spacingHorizontalXS,
  },
  treeGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  branchButton: {
    width: '100%',
    display: 'flex',
    minHeight: '28px',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: tokens.spacingHorizontalXXS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalXXS,
    paddingRight: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalXS,
  },
  branchChevron: {
    transitionDuration: tokens.durationFast,
    transitionProperty: 'transform',
    transitionTimingFunction: tokens.curveEasyEase,
  },
  branchChevronExpanded: {
    transform: 'rotate(90deg)',
  },
  branchIcon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
    color: tokens.colorNeutralForeground3,
  },
  emptyList: {
    margin: 0,
    padding: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
  },
  streamButton: {
    width: '100%',
    minHeight: '30px',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: tokens.spacingHorizontalXXS,
    marginBottom: tokens.spacingVerticalXXS,
    cursor: 'grab',
  },
  draggingStreamButton: {
    cursor: 'grabbing',
    opacity: 0.45,
  },
  wall: {
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    overflow: 'auto',
    backgroundColor: tokens.colorNeutralBackground3,
    padding: 0,
  },
  grid: {
    display: 'grid',
    width: '100%',
    height: '100%',
    minHeight: 0,
    gap: tokens.strokeWidthThin,
    gridAutoRows: 'minmax(0, 1fr)',
    backgroundColor: tokens.colorNeutralStroke3,
  },
  cell: {
    position: 'relative',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: 0,
    outlineStyle: 'none',
    boxShadow: 'none',
    transitionDuration: tokens.durationFast,
    transitionProperty: 'background-color, box-shadow',
    transitionTimingFunction: tokens.curveEasyEase,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      boxShadow: `inset 0 0 0 ${tokens.strokeWidthThin} ${tokens.colorNeutralStroke1}`,
    },
  },
  dragOverCell: {
    backgroundColor: tokens.colorBrandBackground2,
    boxShadow: `inset 0 0 0 ${tokens.strokeWidthThick} ${tokens.colorBrandStroke1}`,
  },
  occupiedCell: {
    backgroundColor: '#000000',
    ':hover': {
      boxShadow: `inset 0 0 0 ${tokens.strokeWidthThin} ${tokens.colorBrandStroke2Hover}`,
    },
  },
  overlay: {
    pointerEvents: 'auto',
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalXS,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    padding: `2px ${tokens.spacingHorizontalXS}`,
    color: '#ffffff',
    opacity: 0,
    transitionDuration: tokens.durationNormal,
    transitionProperty: 'opacity',
    transitionTimingFunction: tokens.curveEasyEase,
  },
  streamName: {
    color: '#ffffff',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase100,
  },
  streamIcon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
    color: tokens.colorNeutralForeground3,
  },
  onlineStreamIcon: {
    color: tokens.colorPaletteLightGreenForeground3,
  },
  titleStatusIcon: {
    width: '8px',
    height: '8px',
    flexShrink: 0,
    color: tokens.colorPaletteLightGreenForeground3,
  },
  clearButton: {
    pointerEvents: 'auto',
    flexShrink: 0,
    minWidth: '20px',
    width: '20px',
    height: '20px',
    padding: 0,
    color: '#ffffff',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    ':hover:active': {
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
  },
  emptyCell: {
    display: 'grid',
    width: '100%',
    height: '100%',
    minHeight: '120px',
    placeItems: 'center',
    textAlign: 'center',
  },
  emptyCopy: {
    color: tokens.colorNeutralForeground3,
    opacity: 0.2,
    transitionDuration: tokens.durationFast,
    transitionProperty: 'opacity',
    transitionTimingFunction: tokens.curveEasyEase,
  },
  emptyTitle: {
    color: tokens.colorNeutralForeground3,
  },
});

interface DraggableStreamProps {
  node: Extract<StreamTreeNode, { type: 'leaf' }>;
  inset: string;
}

interface RegisterStreamDraggableOptions {
  element: ElementRef<'button'>;
  streamName: string;
  setIsDragging: (isDragging: boolean) => void;
}

export function registerStreamDraggable(
  { element, streamName, setIsDragging }: RegisterStreamDraggableOptions,
  register: typeof draggable = draggable
) {
  return register({
    element,
    getInitialData: () => createStreamAssignmentDragData(streamName),
    onDragStart: () => setIsDragging(true),
    onDrop: () => setIsDragging(false),
  });
}

function DraggableStream({ node, inset }: DraggableStreamProps) {
  const styles = useStyles();
  const elementRef = useRef<ElementRef<'button'>>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isOnline = isStreamOnline(node.stream);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    return registerStreamDraggable({
      element,
      streamName: node.stream.name,
      setIsDragging,
    });
  }, [node.stream.name]);

  return (
    <Button
      ref={elementRef}
      appearance="subtle"
      aria-label={`Drag ${node.stream.name} to a grid cell`}
      className={mergeClasses(styles.streamButton, isDragging && styles.draggingStreamButton)}
      style={{ paddingLeft: `calc(${inset} + 8px)` }}
    >
      {isOnline ? (
        <Video16Filled className={mergeClasses(styles.streamIcon, styles.onlineStreamIcon)} />
      ) : (
        <VideoOff16Regular className={styles.streamIcon} />
      )}
      <Text font="monospace" truncate>
        {node.label}
      </Text>
    </Button>
  );
}

interface GridDropCellProps {
  index: number;
  streamName: string | null;
  setGridStream: (slot: number, streamName: string) => void;
  clearGridStream: (slot: number) => void;
}

interface RegisterGridDropTargetOptions {
  element: ElementRef<'div'>;
  slot: number;
  setGridStream: (slot: number, streamName: string) => void;
  setIsDraggedOver: (isDraggedOver: boolean) => void;
}

export function registerGridDropTarget(
  { element, slot, setGridStream, setIsDraggedOver }: RegisterGridDropTargetOptions,
  register: typeof dropTargetForElements = dropTargetForElements
) {
  return register({
    element,
    canDrop: ({ source }) => isStreamAssignmentDragData(source.data),
    onDragEnter: () => setIsDraggedOver(true),
    onDragLeave: () => setIsDraggedOver(false),
    onDrop: ({ source }) => {
      setIsDraggedOver(false);
      assignDroppedStream(source.data, slot, setGridStream);
    },
  });
}

function GridDropCell({ index, streamName, setGridStream, clearGridStream }: GridDropCellProps) {
  const styles = useStyles();
  const closeButtonStyles = useCloseButtonStyles();
  const elementRef = useRef<ElementRef<'div'>>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    return registerGridDropTarget({
      element,
      slot: index,
      setGridStream,
      setIsDraggedOver,
    });
  }, [index, setGridStream]);

  return (
    <div
      ref={elementRef}
      aria-label={`Grid slot ${index + 1}${streamName ? `, ${streamName}` : ', empty'}`}
      className={mergeClasses(
        'stream-grid-cell',
        styles.cell,
        streamName ? styles.occupiedCell : undefined,
        isDraggedOver ? styles.dragOverCell : undefined
      )}
    >
      {streamName ? (
        <>
          <VideoPlayer streamName={streamName} fillCell />
          <div className={mergeClasses('stream-grid-overlay', styles.overlay)}>
            <div className="flex min-w-0 items-center gap-2">
              <Text font="monospace" size={100} truncate className={styles.streamName}>
                {streamName}
              </Text>
              <CircleFilled className={styles.titleStatusIcon} />
            </div>
            <Button
              appearance="subtle"
              size="small"
              icon={<DismissRegular style={{ fontSize: 16 }} />}
              onClick={() => clearGridStream(index)}
              className={mergeClasses(styles.clearButton, closeButtonStyles.dangerHover)}
              title="Close"
              aria-label="Close"
            />
          </div>
        </>
      ) : (
        <div className={styles.emptyCell}>
          <div className={mergeClasses('stream-grid-empty-copy', styles.emptyCopy)}>
            <Text size={200} weight="semibold" className={styles.emptyTitle}>
              MediaMTX
            </Text>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MultiPlayerGrid({ streams }: MultiPlayerGridProps) {
  const styles = useStyles();
  const gridLayout = usePlayerStore((state) => state.gridLayout);
  const activeGridStreams = usePlayerStore((state) => state.activeGridStreams);
  const setGridStream = usePlayerStore((state) => state.setGridStream);
  const clearGridStream = usePlayerStore((state) => state.clearGridStream);
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Set<string>>(() => new Set());
  const streamTree = useMemo(() => buildStreamTree(streams), [streams]);

  const gridDetails = GRID_DETAILS[gridLayout];
  const slotCount = gridDetails.slotCount;

  const toggleBranch = (branchId: string) => {
    setCollapsedBranchIds((current) => {
      const next = new Set(current);

      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }

      return next;
    });
  };

  const renderTreeNodes = (nodes: StreamTreeNode[], depth = 0): ReactNode[] =>
    nodes.map((node) => {
      const inset = `${depth * 14}px`;

      if (node.type === 'branch') {
        const isExpanded = !collapsedBranchIds.has(node.id);

        return (
          <div key={node.id} className={styles.treeGroup}>
            <Button
              appearance="subtle"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.label}`}
              className={styles.branchButton}
              onClick={() => toggleBranch(node.id)}
              style={{ paddingLeft: `calc(${inset} + 4px)` }}
            >
              <ChevronRight16Regular
                className={mergeClasses(
                  styles.branchIcon,
                  styles.branchChevron,
                  isExpanded && styles.branchChevronExpanded
                )}
              />
              <Folder16Regular className={styles.branchIcon} />
              <Text truncate>{node.label}</Text>
            </Button>
            {isExpanded && renderTreeNodes(node.children, depth + 1)}
          </div>
        );
      }

      return <DraggableStream key={node.id} node={node} inset={inset} />;
    });

  return (
    <div className={styles.root}>
      <aside aria-label="Streams available for grid assignment" className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Text className={styles.sidebarTitle} size={200} weight="semibold">
            Streams
          </Text>
          <Text as="p" className={styles.sidebarHint} size={100}>
            Drag a stream onto a grid cell
          </Text>
        </div>

        <div className={styles.streamList}>
          {streams.length === 0 ? (
            <Text as="p" size={200} className={styles.emptyList}>
              No streams found
            </Text>
          ) : (
            renderTreeNodes(streamTree)
          )}
        </div>
      </aside>

      <div className={styles.wall}>
        <div
          aria-label={`${gridLayout} video grid`}
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${gridDetails.columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: slotCount }, (_, index) => {
            const streamName = activeGridStreams.get(index) ?? null;

            return (
              <GridDropCell
                key={index}
                index={index}
                streamName={streamName}
                setGridStream={setGridStream}
                clearGridStream={clearGridStream}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
