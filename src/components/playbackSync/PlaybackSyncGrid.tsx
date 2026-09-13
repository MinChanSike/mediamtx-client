import { Button, makeStyles, tokens } from '@fluentui/react-components';
import GridLayoutIcon from '@src/components/common/GridLayoutIcon';
import type { RecordedPlaybackSyncController, TileSnapshot } from '@src/playbackSync/recordedPlaybackSyncController';
import usePlaybackSyncStore, { type PlaybackLayout } from '@src/store/usePlaybackSyncStore';
import PlaybackSyncTile from '@src/components/playbackSync/PlaybackSyncTile';

export interface SlotSpansStatus {
  error: Error | null;
  isLoading: boolean;
}

interface PlaybackGridProps {
  controller: RecordedPlaybackSyncController;
  tileSnapshots: Record<string, TileSnapshot>;
  slotSpansStatus: Array<SlotSpansStatus>;
}

const GRID_DETAILS = {
  '1x2': { slotCount: 2, columns: 2 },
  '2x2': { slotCount: 4, columns: 2 },
} as const;

const GRID_LAYOUT_OPTIONS: readonly PlaybackLayout[] = ['1x2', '2x2'];

const useStyles = makeStyles({
  wall: {
    position: 'relative',
    display: 'flex',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  layoutGroup: {
    position: 'absolute',
    right: '-1px',
    bottom: '100%',
    zIndex: 3,
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    gap: tokens.spacingHorizontalXXS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderTopLeftRadius: tokens.borderRadiusMedium,
    borderTopRightRadius: tokens.borderRadiusMedium,
    borderBottom: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalXXS,
  },
  layoutButton: {
    minWidth: '30px',
    width: '30px',
    height: '26px',
    paddingRight: tokens.spacingHorizontalXXS,
    paddingLeft: tokens.spacingHorizontalXXS,
  },
  grid: {
    display: 'grid',
    width: '100%',
    height: '100%',
    minHeight: 0,
    gap: tokens.strokeWidthThin,
    gridAutoRows: 'minmax(0, 1fr)',
    backgroundColor: tokens.colorNeutralStroke2,
  },
});

/**
 * Recorded playback grid with `1x1` and `2x2` layouts. Tiles are independent:
 * each manages its own `<video>` element, states and retries.
 */
export default function PlaybackSyncGrid({
  controller,
  tileSnapshots,
  slotSpansStatus,
}: PlaybackGridProps) {
  const styles = useStyles();
  const layout = usePlaybackSyncStore((s) => s.layout);
  const setLayout = usePlaybackSyncStore((s) => s.setLayout);
  const slots = usePlaybackSyncStore((s) => s.slots);

  const details = GRID_DETAILS[layout];

  return (
    <div className={styles.wall} aria-label={`${layout} recorded playback grid`}>
      <div className={styles.layoutGroup} role="group" aria-label="Grid layout size">
        {GRID_LAYOUT_OPTIONS.map((option) => (
          <Button
            key={option}
            aria-label={`Use ${option} grid layout`}
            aria-pressed={layout === option}
            appearance={layout === option ? 'primary' : 'subtle'}
            icon={<GridLayoutIcon layout={option} />}
            onClick={() => setLayout(option)}
            size="small"
            className={styles.layoutButton}
          />
        ))}
      </div>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${details.columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: details.slotCount }, (_, slot) => (
          <PlaybackSyncTile
            key={`${slot}:${slots.get(slot) ?? 'empty'}`}
            slot={slot}
            path={slots.get(slot) ?? null}
            controller={controller}
            tile={tileSnapshots[String(slot)]}
            spansError={slotSpansStatus[slot]?.error ?? null}
            spansLoading={slotSpansStatus[slot]?.isLoading ?? false}
          />
        ))}
      </div>
    </div>
  );
}
