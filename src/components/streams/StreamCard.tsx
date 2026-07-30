import {
  Badge,
  Button,
  Card,
  Caption1,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  AddSquareRegular,
  DeleteRegular,
  PlugDisconnected20Regular,
  EditRegular,
  InfoRegular,
  PlayRegular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import type { PathItem } from '@src/types/stream';
import StatusBadge from '@src/components/common/StatusBadge';
import { formatBytes, formatProtocol } from '@src/utils/formatters';
import { isStreamOnline } from '@src/utils/streamStatus';
import { getDisplayProtocol, getSourceKickTarget } from '@src/utils/streamDisplay';
import { useKickStreamTarget } from '@src/hooks/useKickStreamTarget';

interface StreamCardProps {
  stream: PathItem;
  onDetails: (stream: PathItem) => void;
  onPlay: (stream: PathItem) => void;
  onAddToGrid: (stream: PathItem) => void;
  onEdit: (stream: PathItem) => void;
  onDelete: (stream: PathItem) => void;
  onViewers: (stream: PathItem) => void;
}

type ActiveConfirmation = 'delete' | 'kickSource' | null;

const useStyles = makeStyles({
  card: {
    gap: tokens.spacingVerticalS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  caption: {
    color: tokens.colorNeutralForeground3,
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalS,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalXS,
  },
  primaryActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
  },
  secondaryActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  viewerButton: {
    minWidth: 0,
    padding: 0,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightRegular,
  },
  confirmation: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    maxWidth: '240px',
  },
  confirmationActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
});

export default function StreamCard({
  stream,
  onDetails,
  onPlay,
  onAddToGrid,
  onEdit,
  onDelete,
  onViewers,
}: StreamCardProps) {
  const styles = useStyles();
  const kickMutation = useKickStreamTarget();
  const [activeConfirmation, setActiveConfirmation] = useState<ActiveConfirmation>(null);
  const protocol = getDisplayProtocol(stream);
  const isOnline = isStreamOnline(stream);
  const sourceKickTarget = getSourceKickTarget(stream);
  const smallIconStyle = { fontSize: 16 };

  function handleDeleteStream() {
    onDelete(stream);
    setActiveConfirmation(null);
  }

  function handleKickSource() {
    if (!sourceKickTarget) return;
    kickMutation.mutate(sourceKickTarget);
    setActiveConfirmation(null);
  }

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Text font="monospace" weight="semibold" truncate>
          {stream.name}
        </Text>
        <StatusBadge status={isOnline ? 'online' : 'offline'} />
      </div>

      <div className={styles.meta}>
        <Badge appearance="tint">{formatProtocol(protocol)}</Badge>
        <Button
          appearance="transparent"
          className={styles.viewerButton}
          aria-label={`View active readers for ${stream.name}`}
          onClick={() => onViewers(stream)}
        >
          {stream.readers.length} reader{stream.readers.length !== 1 ? 's' : ''}
        </Button>
      </div>

      <div className={styles.metrics}>
        <Caption1 className={styles.caption}>In: {formatBytes(stream.bytesReceived)}</Caption1>
        <Caption1 className={styles.caption}>Out: {formatBytes(stream.bytesSent)}</Caption1>
      </div>

      <div className={styles.actions}>
        <div className={styles.primaryActions}>
          <Button
            appearance="primary"
            icon={<PlayRegular style={smallIconStyle} />}
            onClick={() => onPlay(stream)}
          >
            Play
          </Button>
          <Button
            icon={<AddSquareRegular style={smallIconStyle} />}
            onClick={() => onAddToGrid(stream)}
          >
            Grid
          </Button>
        </div>

        <div className={styles.secondaryActions}>
          <Button icon={<InfoRegular style={smallIconStyle} />} onClick={() => onDetails(stream)}>
            Details
          </Button>
          {stream.isConfigured && (
            <Button icon={<EditRegular style={smallIconStyle} />} onClick={() => onEdit(stream)}>
              Edit
            </Button>
          )}
          {stream.isConfigured && (
            <Popover
              open={activeConfirmation === 'delete'}
              onOpenChange={(_, data) => {
                setActiveConfirmation(data.open ? 'delete' : null);
              }}
              positioning="below-end"
            >
              <PopoverTrigger disableButtonEnhancement>
                <Button icon={<DeleteRegular style={smallIconStyle} />}>Delete</Button>
              </PopoverTrigger>
              <PopoverSurface>
                <div className={styles.confirmation}>
                  <Text size={200}>{`Delete stream "${stream.name}"?`}</Text>
                  <div className={styles.confirmationActions}>
                    <Button
                      appearance="secondary"
                      size="small"
                      onClick={() => setActiveConfirmation(null)}
                    >
                      Cancel
                    </Button>
                    <Button appearance="primary" size="small" onClick={handleDeleteStream}>
                      Confirm
                    </Button>
                  </div>
                </div>
              </PopoverSurface>
            </Popover>
          )}
          {sourceKickTarget && (
            <Popover
              open={activeConfirmation === 'kickSource'}
              onOpenChange={(_, data) => {
                setActiveConfirmation(data.open ? 'kickSource' : null);
              }}
              positioning="below-start"
            >
              <PopoverTrigger disableButtonEnhancement>
                <Button
                  icon={<PlugDisconnected20Regular />}
                  aria-label={`Kick source for ${stream.name}`}
                  disabled={kickMutation.isPending}
                >
                  Kick Source
                </Button>
              </PopoverTrigger>
              <PopoverSurface>
                <div className={styles.confirmation}>
                  <Text size={200}>{`Kick source for stream "${stream.name}"?`}</Text>
                  <div className={styles.confirmationActions}>
                    <Button
                      appearance="secondary"
                      size="small"
                      onClick={() => setActiveConfirmation(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      appearance="primary"
                      size="small"
                      disabled={kickMutation.isPending}
                      onClick={handleKickSource}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              </PopoverSurface>
            </Popover>
          )}
        </div>
      </div>
    </Card>
  );
}
