import { useMemo, useState } from 'react';
import {
  Button,
  Input,
  Spinner,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowClockwise16Regular,
  Search16Regular,
  VideoClip16Regular,
  VideoOff16Regular,
} from '@fluentui/react-icons';
import type { Recording } from '@src/schemas/recordingSchema';

interface PlaybackStreamListProps {
  recordings: Recording[];
  selectedStream: string | null;
  isLoading: boolean;
  isError: boolean;
  onSelect: (pathName: string) => void;
  onRefresh: () => void;
}

const useStyles = makeStyles({
  root: {
    boxSizing: 'border-box',
    display: 'flex',
    width: '200px',
    minWidth: '200px',
    height: '100%',
    minHeight: 0,
    flexDirection: 'column',
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    '@media (max-width: 900px)': {
      width: '160px',
      minWidth: '160px',
    },
  },
  header: {
    display: 'flex',
    minHeight: '44px',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    paddingLeft: tokens.spacingHorizontalS,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
  },
  iconButton: {
    minWidth: '32px',
    width: '32px',
  },
  search: {
    flexShrink: 0,
    margin: tokens.spacingHorizontalXS,
    marginBottom: 0,
  },
  list: {
    minHeight: 0,
    flex: 1,
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXS}`,
  },
  streamButton: {
    display: 'flex',
    width: '100%',
    minWidth: 0,
    minHeight: '40px',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    textAlign: 'left',
  },
  streamIcon: {
    flexShrink: 0,
    color: tokens.colorPaletteLightGreenForeground3,
  },
  streamName: {
    fontFamily: tokens.fontFamilyMonospace,
  },
  empty: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
});

/** Streams column of the file-playback page: one entry per recorded path. */
export default function PlaybackStreamList({
  recordings,
  selectedStream,
  isLoading,
  isError,
  onSelect,
  onRefresh,
}: PlaybackStreamListProps) {
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const visibleRecordings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sorted = [...recordings].sort((a, b) => a.name.localeCompare(b.name));
    return normalizedQuery
      ? sorted.filter((recording) => recording.name.toLowerCase().includes(normalizedQuery))
      : sorted;
  }, [recordings, query]);

  return (
    <aside className={styles.root} aria-label="Recorded streams">
      <div className={styles.header}>
        <Text weight="semibold">Streams</Text>
        <div className={styles.headerActions}>
          <Tooltip content="Filter streams" relationship="label">
            <Button
              className={styles.iconButton}
              appearance={isSearchVisible ? 'secondary' : 'subtle'}
              icon={<Search16Regular />}
              aria-label="Toggle stream filter"
              onClick={() => {
                setIsSearchVisible((visible) => !visible);
                if (isSearchVisible) setQuery('');
              }}
            />
          </Tooltip>
          <Tooltip content="Refresh recordings" relationship="label">
            <Button
              className={styles.iconButton}
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
            <Text size={100}>Loading streams…</Text>
          </div>
        ) : isError ? (
          <div className={styles.empty}>
            <VideoOff16Regular />
            <Text size={100}>Unable to load recordings</Text>
          </div>
        ) : visibleRecordings.length === 0 ? (
          <div className={styles.empty}>
            <VideoOff16Regular />
            <Text size={100}>
              {recordings.length === 0 ? 'No recorded streams' : 'No matching streams'}
            </Text>
          </div>
        ) : (
          visibleRecordings.map((recording) => {
            const isSelected = recording.name === selectedStream;
            return (
              <Button
                key={recording.name}
                className={styles.streamButton}
                appearance={isSelected ? 'secondary' : 'subtle'}
                onClick={() => onSelect(recording.name)}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={`Select stream ${recording.name}`}
              >
                <VideoClip16Regular className={styles.streamIcon} />
                <Text className={styles.streamName} truncate>
                  {recording.name}
                </Text>
              </Button>
            );
          })
        )}
      </div>
    </aside>
  );
}
