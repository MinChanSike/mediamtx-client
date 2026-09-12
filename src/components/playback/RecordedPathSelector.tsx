import { useMemo, useState } from 'react';
import {
  Field,
  Input,
  Listbox,
  Option,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  makeStyles,
  tokens,
  useId,
} from '@fluentui/react-components';
import { Record24Regular, Search24Regular } from '@fluentui/react-icons';
import type { Recording } from '@src/schemas/recordingSchema';
import type { PlaybackLayout } from '@src/store/usePlaybackStore';

interface RecordedPathSelectorProps {
  recordings: Recording[];
  assignedPaths: Set<string>;
  layout: PlaybackLayout;
  /** Number of slots currently visible in the active layout. */
  visibleSlotCount: number;
  onAssign: (path: string) => void;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '260px',
    flex: 1,
    maxWidth: '380px',
  },
  hint: {
    display: 'block',
    color: tokens.colorNeutralForeground3,
    minHeight: tokens.spacingVerticalL,
  },
  surface: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalS,
    minWidth: '300px',
    maxHeight: '320px',
  },
  list: {
    maxHeight: '260px',
    overflowY: 'auto',
  },
  optionContent: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  optionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
});

function formatRecordingHint(recording: Recording): string {
  const starts = recording.segments
    .map((segment) => Date.parse(segment.start))
    .filter((value) => !Number.isNaN(value));
  if (starts.length === 0) return 'no segments';

  const first = new Date(Math.min(...starts)).toISOString().slice(0, 10);
  const last = new Date(Math.max(...starts)).toISOString().slice(0, 10);
  return first === last ? `recorded ${first}` : `recorded ${first} – ${last}`;
}

/**
 * Searchable recorded-path selector populated from the Control API
 * recordings catalog. Selecting a path asks the page to assign it to the
 * first free slot of the active layout.
 */
export default function RecordedPathSelector({
  recordings,
  assignedPaths,
  layout,
  visibleSlotCount,
  onAssign,
}: RecordedPathSelectorProps) {
  const styles = useStyles();
  const searchId = useId('recorded-path-search');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...recordings].sort((a, b) => a.name.localeCompare(b.name));
    if (!query) return sorted;
    return sorted.filter((recording) => recording.name.toLowerCase().includes(query));
  }, [recordings, search]);

  const hint = useMemo(() => {
    if (recordings.length === 0) return 'No recordings on this server';
    if (assignedPaths.size >= visibleSlotCount) {
      return `All ${visibleSlotCount} slot${visibleSlotCount > 1 ? 's' : ''} in use — remove a tile to assign another`;
    }
    return `${recordings.length} recorded path${recordings.length > 1 ? 's' : ''} • ${layout} layout`;
  }, [recordings.length, assignedPaths.size, visibleSlotCount, layout]);

  const select = (path: string) => {
    onAssign(path);
    setSearch('');
    setOpen(false);
  };

  return (
    <div className={styles.root}>
      <Field label="Recorded path">
        <Popover
          open={open}
          onOpenChange={(_event, data) => setOpen(data.open)}
          positioning="below-start"
        >
          <PopoverTrigger disableButtonEnhancement>
            <Input
              id={searchId}
              contentBefore={<Search24Regular />}
              placeholder="Search recorded paths..."
              value={search}
              onChange={(_event, data) => {
                setSearch(data.value);
                setOpen(true);
              }}
              aria-label="Search recorded paths"
              aria-expanded={open}
            />
          </PopoverTrigger>
          <PopoverSurface className={styles.surface}>
            {filtered.length === 0 ? (
              <Text size={200}>No matching recorded paths</Text>
            ) : (
              <Listbox aria-label="Recorded paths" className={styles.list}>
                {filtered.map((recording) => {
                  const isAssigned = assignedPaths.has(recording.name);
                  return (
                    <Option
                      key={recording.name}
                      value={recording.name}
                      text={recording.name}
                      disabled={isAssigned}
                      onClick={() => select(recording.name)}
                    >
                      <span className={styles.optionContent}>
                        <span className={styles.optionTitle}>
                          <Record24Regular />
                          <span>{recording.name}</span>
                          {isAssigned && <Text size={100}>• assigned</Text>}
                        </span>
                        <Text size={100}>{formatRecordingHint(recording)}</Text>
                      </span>
                    </Option>
                  );
                })}
              </Listbox>
            )}
          </PopoverSurface>
        </Popover>
      </Field>
      <Text as="p" size={100} className={styles.hint}>
        {hint}
      </Text>
    </div>
  );
}
