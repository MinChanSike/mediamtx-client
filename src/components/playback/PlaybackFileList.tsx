import { useMemo, useState } from 'react';
import {
  Button,
  Input,
  Spinner,
  Switch,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowDownload16Regular,
  ArrowSortDownLinesRegular,
  ArrowSortUpLinesRegular,
  DismissCircle16Regular,
  Play16Regular,
  Search16Regular,
} from '@fluentui/react-icons';
import { recordedFileKey, type RecordedFile } from '@src/api/playbackApi';
import {
  formatFileDuration,
  formatFileRecordedAt,
  getVisibleRecordedFiles,
  type RecordedFileSortDirection,
} from '@src/utils/recordedFileFormat';

interface PlaybackFileListProps {
  files: RecordedFile[];
  selectedKey: string | null;
  streamName: string | null;
  isLoading: boolean;
  isError: boolean;
  autoplayEnabled: boolean;
  onToggleAutoplay: (enabled: boolean) => void;
  onSelect: (file: RecordedFile) => void;
  onDownload: (file: RecordedFile) => Promise<void>;
  onRetry: () => void;
}

const useStyles = makeStyles({
  root: {
    boxSizing: 'border-box',
    display: 'flex',
    width: '248px',
    minWidth: '248px',
    height: '100%',
    minHeight: 0,
    flexDirection: 'column',
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    '@media (max-width: 900px)': {
      width: '200px',
      minWidth: '200px',
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
  fileRowWrap: {
    position: 'relative',
    marginBottom: tokens.spacingVerticalXS,
  },
  fileRow: {
    display: 'flex',
    width: '100%',
    minWidth: 0,
    minHeight: '44px',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXS}`,
    paddingRight: '38px',
    textAlign: 'left',
  },
  fileIcon: {
    flexShrink: 0,
    color: tokens.colorNeutralForeground2,
  },
  fileCopy: {
    display: 'flex',
    minWidth: 0,
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  fileStart: {
    fontFamily: tokens.fontFamilyMonospace,
    lineHeight: tokens.lineHeightBase200,
  },
  fileMeta: {
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase100,
  },
  downloadButton: {
    position: 'absolute',
    top: '50%',
    right: tokens.spacingHorizontalXS,
    transform: 'translateY(-50%)',
    minWidth: '28px',
    width: '28px',
    minHeight: '28px',
  },
  footer: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
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

/** Video-files column: one row per recorded segment of the selected stream. */
export default function PlaybackFileList({
  files,
  selectedKey,
  streamName,
  isLoading,
  isError,
  autoplayEnabled,
  onToggleAutoplay,
  onSelect,
  onDownload,
  onRetry,
}: PlaybackFileListProps) {
  const styles = useStyles();
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [sortDirection, setSortDirection] =
    useState<RecordedFileSortDirection>('ascending');

  const visibleFiles = useMemo(
    () => getVisibleRecordedFiles(files, query, sortDirection),
    [files, query, sortDirection]
  );
  const sortActionLabel =
    sortDirection === 'ascending' ? 'Sort files newest first' : 'Sort files oldest first';

  const handleDownload = (file: RecordedFile) => {
    const key = recordedFileKey(file);
    setDownloadingKey(key);
    Promise.resolve(onDownload(file))
      .catch(() => undefined)
      .finally(() => {
        setDownloadingKey((current) => (current === key ? null : current));
      });
  };

  return (
    <aside className={styles.root} aria-label="Recorded video files">
      <div className={styles.header}>
        <Text weight="semibold">Video files</Text>
        <div className={styles.headerActions}>
          <Tooltip content="Filter files" relationship="label">
            <Button
              className={styles.iconButton}
              appearance={isFilterVisible ? 'secondary' : 'subtle'}
              icon={<Search16Regular />}
              aria-label="Toggle file filter"
              aria-pressed={isFilterVisible}
              onClick={() => {
                setIsFilterVisible((visible) => !visible);
                if (isFilterVisible) setQuery('');
              }}
            />
          </Tooltip>
          <Tooltip content={sortActionLabel} relationship="label">
            <Button
              className={styles.iconButton}
              appearance="subtle"
              icon={
                sortDirection === 'ascending' ? (
                  <ArrowSortDownLinesRegular />
                ) : (
                  <ArrowSortUpLinesRegular />
                )
              }
              aria-label={sortActionLabel}
              onClick={() =>
                setSortDirection((direction) =>
                  direction === 'ascending' ? 'descending' : 'ascending'
                )
              }
            />
          </Tooltip>
        </div>
      </div>

      {isFilterVisible && (
        <Input
          className={styles.search}
          value={query}
          onChange={(_event, data) => setQuery(data.value)}
          placeholder="Filter by date or time"
          aria-label="Filter recorded files by date or time"
          autoFocus
        />
      )}

      <div className={styles.list}>
        {streamName === null ? (
          <div className={styles.empty}>
            <Text size={100}>Select a stream to list its recorded files</Text>
          </div>
        ) : isLoading ? (
          <div className={styles.empty}>
            <Spinner size="extra-small" />
            <Text size={100}>Loading files…</Text>
          </div>
        ) : isError ? (
          <div className={styles.empty}>
            <DismissCircle16Regular />
            <Text size={100}>Unable to load files</Text>
            <Button size="small" appearance="primary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : files.length === 0 ? (
          <div className={styles.empty}>
            <Text size={100}>No recorded files for this stream</Text>
          </div>
        ) : visibleFiles.length === 0 ? (
          <div className={styles.empty}>
            <Text size={100}>No matching files</Text>
          </div>
        ) : (
          visibleFiles.map((file) => {
            const key = recordedFileKey(file);
            const isSelected = key === selectedKey;
            const recordedAt = formatFileRecordedAt(file.startMs);
            return (
              <div key={key} className={styles.fileRowWrap}>
                <Button
                  className={styles.fileRow}
                  appearance={isSelected ? 'secondary' : 'subtle'}
                  onClick={() => onSelect(file)}
                  aria-current={isSelected ? 'true' : undefined}
                  aria-label={`Play file recorded at ${recordedAt}`}
                >
                  <Play16Regular className={styles.fileIcon} />
                  <span className={styles.fileCopy}>
                    <Text className={styles.fileStart} truncate>
                      {recordedAt}
                    </Text>
                    <Text className={styles.fileMeta} size={100}>
                      {formatFileDuration(file.durationMs)}
                    </Text>
                  </span>
                </Button>
                <Tooltip content="Download file" relationship="label">
                  <Button
                    className={styles.downloadButton}
                    appearance="subtle"
                    size="small"
                    icon={
                      downloadingKey === key ? (
                        <Spinner size="extra-tiny" />
                      ) : (
                        <ArrowDownload16Regular />
                      )
                    }
                    aria-label={`Download file recorded at ${recordedAt}`}
                    onClick={() => handleDownload(file)}
                  />
                </Tooltip>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.footer}>
        <Text size={200}>auto play</Text>
        <Switch
          checked={autoplayEnabled}
          onChange={(_event, data) => onToggleAutoplay(data.checked)}
          aria-label="Auto play consecutive files"
        />
      </div>
    </aside>
  );
}
