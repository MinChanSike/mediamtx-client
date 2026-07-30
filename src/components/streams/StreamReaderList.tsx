import type { MouseEvent } from 'react';
import { useState } from 'react';
import {
  Button,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { PlugDisconnected20Regular } from '@fluentui/react-icons';
import type { Reader } from '@src/types/stream';
import { useKickStreamTarget } from '@src/hooks/useKickStreamTarget';
import {
  VIEWER_TABLE_COLUMNS,
  getViewerTableRows,
  type ViewerTableRow,
} from '@src/utils/streamDetails';

interface StreamReaderListProps {
  readers: readonly Reader[];
  onSelectViewer?: (row: ViewerTableRow) => void;
}

const useStyles = makeStyles({
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  tableScroll: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    '& th': {
      padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXS}`,
      borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
      color: tokens.colorNeutralForeground2,
      fontSize: tokens.fontSizeBase200,
      fontWeight: tokens.fontWeightSemibold,
      textAlign: 'left',
      whiteSpace: 'nowrap',
    },
    '& td': {
      padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXS}`,
      borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
      fontSize: tokens.fontSizeBase200,
      verticalAlign: 'middle',
      whiteSpace: 'nowrap',
    },
  },
  viewerIdColumn: {
    width: '70%',
  },
  viewerTypeColumn: {
    width: '30%',
  },
  viewerActionColumn: {
    width: '40px',
  },
  viewerIdButton: {
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nowrapCell: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actionCell: {
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  confirmation: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    maxWidth: '220px',
  },
  confirmationActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
});

export default function StreamReaderList({ readers, onSelectViewer }: StreamReaderListProps) {
  const styles = useStyles();
  const kickMutation = useKickStreamTarget();
  const [activeKickRowKey, setActiveKickRowKey] = useState<string | null>(null);
  const viewerRows = getViewerTableRows(readers);

  function handleConfirmKickViewer(event: MouseEvent<HTMLElement>, row: ViewerTableRow) {
    event.preventDefault();
    event.stopPropagation();

    if (!row.kickTarget) return;
    kickMutation.mutate(row.kickTarget);
    setActiveKickRowKey(null);
  }

  if (viewerRows.length === 0) {
    return <Text className={styles.muted}>No active readers</Text>;
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            {VIEWER_TABLE_COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className={column === 'ID' ? styles.viewerIdColumn : styles.viewerTypeColumn}
              >
                {column}
              </th>
            ))}
            <th scope="col" aria-label="Actions" className={styles.viewerActionColumn} />
          </tr>
        </thead>
        <tbody>
          {viewerRows.map((row) => (
            <tr key={row.key}>
              <td className={mergeClasses(styles.nowrapCell, '!pl-0')}>
                <Button
                  appearance="transparent"
                  size="small"
                  className={styles.viewerIdButton}
                  disabled={!row.detailTarget || !onSelectViewer}
                  onClick={() => onSelectViewer?.(row)}
                >
                  {row.identity}
                </Button>
              </td>
              <td className={styles.nowrapCell}>
                <Text truncate size={200}>
                  {row.type}
                </Text>
              </td>
              <td className={styles.actionCell}>
                {row.kickTarget ? (
                  <Popover
                    open={activeKickRowKey === row.key}
                    onOpenChange={(_, data) => {
                      setActiveKickRowKey(data.open ? row.key : null);
                    }}
                    positioning="below-end"
                  >
                    <PopoverTrigger disableButtonEnhancement>
                      <Tooltip content="Kick Out" relationship="label">
                        <Button
                          appearance="subtle"
                          size="small"
                          aria-label="Kick Out"
                          icon={<PlugDisconnected20Regular />}
                          disabled={kickMutation.isPending}
                        />
                      </Tooltip>
                    </PopoverTrigger>
                    <PopoverSurface>
                      <div className={styles.confirmation}>
                        <Text size={200}>Kick out reader {row.identity}?</Text>
                        <div className={styles.confirmationActions}>
                          <Button
                            appearance="secondary"
                            size="small"
                            onClick={() => setActiveKickRowKey(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            appearance="primary"
                            size="small"
                            disabled={kickMutation.isPending}
                            onClick={(event) => handleConfirmKickViewer(event, row)}
                          >
                            Kick Out
                          </Button>
                        </div>
                      </div>
                    </PopoverSurface>
                  </Popover>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
