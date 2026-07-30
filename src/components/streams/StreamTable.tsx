import { useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import {
  AddSquareRegular,
  ArrowSortRegular,
  ArrowSortDownRegular,
  ArrowSortUpRegular,
  DeleteRegular,
  EditRegular,
  InfoRegular,
  PlayRegular,
} from '@fluentui/react-icons';
import type { PathItem } from '@src/types/stream';
import StatusBadge from '@src/components/common/StatusBadge';
import { formatBytes, formatProtocol } from '@src/utils/formatters';
import { isStreamOnline } from '@src/utils/streamStatus';
import { shouldEnableTableScroll } from '@src/components/streams/streamTableLayout';
import { getDisplayProtocol } from '@src/utils/streamDisplay';

interface StreamTableProps {
  streams: PathItem[];
  onDetails: (stream: PathItem) => void;
  onPlay: (stream: PathItem) => void;
  onAddToGrid: (stream: PathItem) => void;
  onEdit: (stream: PathItem) => void;
  onDelete: (stream: PathItem) => void;
}

type SortColumn = 'name' | 'protocol' | 'tracks' | 'readers' | 'bytesIn' | 'bytesOut' | 'status';
type SortDirection = 'ascending' | 'descending';

const SORTABLE_COLUMNS: Array<{ key: SortColumn; label: string }> = [
  { key: 'name', label: 'Stream Name' },
  { key: 'protocol', label: 'Protocol' },
  { key: 'tracks', label: 'Tracks' },
  { key: 'readers', label: 'Readers' },
  { key: 'bytesIn', label: 'Bytes In' },
  { key: 'bytesOut', label: 'Bytes Out' },
  { key: 'status', label: 'Status' },
];

const useStyles = makeStyles({
  tableWrap: {
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
    minHeight: 0,
    flex: 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  scrollTableWrap: {
    overflowY: 'auto',
  },
  table: {
    minWidth: '1160px',
    tableLayout: 'fixed',
  },
  headerCell: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  sortButton: {
    height: '28px',
    minHeight: '28px',
    minWidth: 0,
    paddingLeft: 0,
    paddingRight: 0,
    fontWeight: tokens.fontWeightSemibold,
  },
  dataCell: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clippedText: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyCell: {
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXXS,
    whiteSpace: 'nowrap',
  },
  actionsCellHeader: {
    width: 'auto',
    minWidth: '180px',
    '> div': { width: 'auto', justifySelf: 'center' },
  },
  actionsCell: {
    width: 'auto',
    minWidth: '180px',
  },
});

function compareStreams(a: PathItem, b: PathItem, column: SortColumn) {
  switch (column) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'protocol':
      return getDisplayProtocol(a).localeCompare(getDisplayProtocol(b));
    case 'tracks':
      return a.tracks.length - b.tracks.length;
    case 'readers':
      return a.readers.length - b.readers.length;
    case 'bytesIn':
      return a.bytesReceived - b.bytesReceived;
    case 'bytesOut':
      return a.bytesSent - b.bytesSent;
    case 'status':
      return Number(isStreamOnline(a)) - Number(isStreamOnline(b));
    default:
      return 0;
  }
}

export default function StreamTable({
  streams,
  onDetails,
  onPlay,
  onAddToGrid,
  onEdit,
  onDelete,
}: StreamTableProps) {
  const styles = useStyles();
  const tableWrapRef = useRef<ElementRef<'div'>>(null);
  const tableRef = useRef<ElementRef<'table'>>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
  const [enableTableScroll, setEnableTableScroll] = useState(false);

  const sortedStreams = useMemo(() => {
    const directionMultiplier = sortDirection === 'ascending' ? 1 : -1;

    return streams
      .map((stream, index) => ({ stream, index }))
      .sort((a, b) => {
        const result = compareStreams(a.stream, b.stream, sortColumn);
        if (result !== 0) return result * directionMultiplier;

        const nameResult = a.stream.name.localeCompare(b.stream.name);
        if (nameResult !== 0) return nameResult;

        return a.index - b.index;
      })
      .map(({ stream }) => stream);
  }, [sortColumn, sortDirection, streams]);

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((current) => (current === 'ascending' ? 'descending' : 'ascending'));
      return;
    }

    setSortColumn(column);
    setSortDirection('ascending');
  };

  const getSortIcon = (column: SortColumn) => {
    if (column !== sortColumn) return <ArrowSortRegular style={{ fontSize: 16 }} />;
    return sortDirection === 'ascending' ? (
      <ArrowSortUpRegular style={{ fontSize: 16 }} />
    ) : (
      <ArrowSortDownRegular style={{ fontSize: 16 }} />
    );
  };

  useEffect(() => {
    const tableWrap = tableWrapRef.current;
    const table = tableRef.current;
    if (!tableWrap) return;

    const updateTableScroll = () => {
      setEnableTableScroll(shouldEnableTableScroll(tableWrap.scrollHeight, tableWrap.clientHeight));
    };

    updateTableScroll();

    if (window.ResizeObserver) {
      const observer = new window.ResizeObserver(updateTableScroll);
      observer.observe(tableWrap);
      if (table) observer.observe(table);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateTableScroll);
    return () => window.removeEventListener('resize', updateTableScroll);
  }, [sortedStreams.length]);

  const smallIconStyle = { fontSize: 16 };

  return (
    <div
      ref={tableWrapRef}
      className={mergeClasses(styles.tableWrap, enableTableScroll && styles.scrollTableWrap)}
    >
      <Table ref={tableRef} aria-label="Streams" className={styles.table} size="small">
        <TableHeader>
          <TableRow>
            {SORTABLE_COLUMNS.map((column) => (
              <TableHeaderCell
                key={column.key}
                aria-sort={sortColumn === column.key ? sortDirection : 'none'}
                className={styles.headerCell}
              >
                <Button
                  appearance="transparent"
                  icon={getSortIcon(column.key)}
                  iconPosition="after"
                  onClick={() => handleSort(column.key)}
                  size="small"
                  className={styles.sortButton}
                  aria-label={`Sort by ${column.label}`}
                >
                  {column.label}
                </Button>
              </TableHeaderCell>
            ))}
            <TableHeaderCell className={mergeClasses(styles.headerCell, styles.actionsCellHeader)}>
              Actions
            </TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedStreams.length > 0 ? (
            sortedStreams.map((stream) => {
              const protocol = getDisplayProtocol(stream);
              const isOnline = isStreamOnline(stream);

              return (
                <TableRow key={stream.name}>
                  <TableCell className={styles.dataCell}>
                    <Text size={200} weight="semibold" truncate className={styles.clippedText}>
                      {stream.name}
                    </Text>
                  </TableCell>
                  <TableCell className={styles.dataCell}>
                    <Badge appearance="tint" size="small">
                      {formatProtocol(protocol)}
                    </Badge>
                  </TableCell>
                  <TableCell className={styles.dataCell}>{stream.tracks.length}</TableCell>
                  <TableCell className={styles.dataCell}>{stream.readers.length}</TableCell>
                  <TableCell className={styles.dataCell}>
                    <Text font="monospace" size={200} truncate className={styles.clippedText}>
                      {formatBytes(stream.bytesReceived)}
                    </Text>
                  </TableCell>
                  <TableCell className={styles.dataCell}>
                    <Text font="monospace" size={200} truncate className={styles.clippedText}>
                      {formatBytes(stream.bytesSent)}
                    </Text>
                  </TableCell>
                  <TableCell className={styles.dataCell}>
                    <StatusBadge status={isOnline ? 'online' : 'offline'} />
                  </TableCell>
                  <TableCell className={mergeClasses(styles.dataCell, styles.actionsCell)}>
                    <div className={styles.actions}>
                      <Button
                        size="small"
                        appearance="primary"
                        icon={<PlayRegular style={smallIconStyle} />}
                        aria-label={`Play ${stream.name}`}
                        title="Play stream"
                        onClick={() => onPlay(stream)}
                      />
                      <Button
                        size="small"
                        icon={<AddSquareRegular style={smallIconStyle} />}
                        aria-label={`Add ${stream.name} to grid`}
                        title="Add to Grid"
                        onClick={() => onAddToGrid(stream)}
                      />
                      <Button
                        size="small"
                        icon={<InfoRegular style={smallIconStyle} />}
                        aria-label={`View details for ${stream.name}`}
                        title="View details"
                        onClick={() => onDetails(stream)}
                      />
                      {stream.isConfigured && (
                        <Button
                          size="small"
                          icon={<EditRegular style={smallIconStyle} />}
                          aria-label={`Edit ${stream.name}`}
                          title="Edit stream config"
                          onClick={() => onEdit(stream)}
                        />
                      )}
                      {stream.isConfigured && (
                        <Button
                          size="small"
                          icon={<DeleteRegular style={smallIconStyle} />}
                          aria-label={`Delete ${stream.name}`}
                          title="Delete stream"
                          onClick={() => onDelete(stream)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell className={styles.emptyCell} colSpan={8}>
                <Text weight="semibold">No streams found</Text>
                <Text size={200}> Add a stream or adjust your filters</Text>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
