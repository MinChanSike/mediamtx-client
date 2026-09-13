import { useMemo } from 'react';
import {
  MessageBar,
  MessageBarBody,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import PlaybackSyncControls from '@src/components/playbackSync/PlaybackSyncControls';
import PlaybackSyncGrid from '@src/components/playbackSync/PlaybackSyncGrid';
import PlaybackSyncRecordingSidebar from '@src/components/playbackSync/PlaybackSyncRecordingSidebar';
import PlaybackSyncTimeline, { type TimelineLane } from '@src/components/playbackSync/PlaybackSyncTimeline';
import { usePlaybackSyncCatalog } from '@src/hooks/usePlaybackSyncCatalog';
import { usePlaybackSyncEndpoint } from '@src/hooks/usePlaybackSyncEndpoint';
import { useSlotSpans } from '@src/hooks/usePlaybackSyncSpans';
import { useRecordedPlaybackSync } from '@src/hooks/useRecordedPlaybackSync';
import usePlaybackSyncStore, {
  PLAYBACK_SLOT_COUNT,
} from '@src/store/usePlaybackSyncStore';
import type { NormalizedSpan } from '@src/utils/playbackSyncIntervals';
import { shiftDayKey } from '@src/utils/playbackSyncTime';

const useStyles = makeStyles({
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 40px)',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    height: '46px',
    flexShrink: 0,
    alignItems: 'center',
  },
  pageTitle: {
    color: tokens.colorNeutralForeground1,
  },
  workspace: {
    display: 'flex',
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    overflow: 'hidden',
  },
  gridArea: {
    display: 'flex',
    minWidth: 0,
    minHeight: '240px',
    flex: 1,
    overflow: 'hidden',
  },
  noticeStack: {
    position: 'absolute',
    top: '40px',
    right: 0,
    left: '220px',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    pointerEvents: 'none',
    '@media (max-width: 760px)': {
      left: '184px',
    },
  },
  notice: {
    pointerEvents: 'auto',
  },
});

export function getVisibleSlotPaths(
  slotPaths: Array<string | null>,
  visibleSlotCount: number
): Array<string | null> {
  return slotPaths.map((path, slot) => (slot < visibleSlotCount ? path : null));
}

export default function PlaybackSyncPage() {
  const styles = useStyles();
  const catalog = usePlaybackSyncCatalog();
  const endpoint = usePlaybackSyncEndpoint();

  const layout = usePlaybackSyncStore((s) => s.layout);
  const slots = usePlaybackSyncStore((s) => s.slots);
  const setSlot = usePlaybackSyncStore((s) => s.setSlot);
  const selectedDay = usePlaybackSyncStore((s) => s.selectedDay);
  const setSelectedDay = usePlaybackSyncStore((s) => s.setSelectedDay);
  const sharedTimestampMs = usePlaybackSyncStore((s) => s.sharedTimestampMs);

  const visibleSlotCount = layout === '1x2' ? 2 : PLAYBACK_SLOT_COUNT;

  const slotPaths = useMemo(
    () => Array.from({ length: PLAYBACK_SLOT_COUNT }, (_, slot) => slots.get(slot) ?? null),
    [slots]
  );
  const visibleSlotPaths = useMemo(
    () => getVisibleSlotPaths(slotPaths, visibleSlotCount),
    [slotPaths, visibleSlotCount]
  );

  const slot0 = useSlotSpans(visibleSlotPaths[0], selectedDay, endpoint.baseUrl);
  const slot1 = useSlotSpans(visibleSlotPaths[1], selectedDay, endpoint.baseUrl);
  const slot2 = useSlotSpans(visibleSlotPaths[2], selectedDay, endpoint.baseUrl);
  const slot3 = useSlotSpans(visibleSlotPaths[3], selectedDay, endpoint.baseUrl);
  const slotSpansResults = [slot0, slot1, slot2, slot3];

  const spansByPath = useMemo(() => {
    const map: Record<string, NormalizedSpan[] | undefined> = {};
    for (let slot = 0; slot < visibleSlotCount; slot += 1) {
      const path = visibleSlotPaths[slot];
      if (path && map[path] === undefined) map[path] = slotSpansResults[slot].spans;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSlotPaths, visibleSlotCount, slot0.spans, slot1.spans, slot2.spans, slot3.spans]);

  const { controller, snapshot } = useRecordedPlaybackSync(spansByPath, endpoint.baseUrl);

  const assignedPaths = useMemo(
    () => new Set(Array.from(slots.values())),
    [slots]
  );

  const lanes: TimelineLane[] = useMemo(
    () =>
      Array.from({ length: visibleSlotCount }, (_, slot) => ({
        slot,
        path: visibleSlotPaths[slot],
        spans: slotSpansResults[slot].spans,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleSlotPaths, visibleSlotCount, slot0.spans, slot1.spans, slot2.spans, slot3.spans]
  );

  const handleAssignPath = (path: string) => {
    for (let slot = 0; slot < visibleSlotCount; slot += 1) {
      if (!slots.has(slot)) {
        setSlot(slot, path);
        return;
      }
    }
  };

  const handleShiftDay = (dayDelta: number) => {
    const nextDay = shiftDayKey(selectedDay, dayDelta);
    if (nextDay) setSelectedDay(nextDay);
  };

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <Title2 as="h1" className={styles.pageTitle}>
          Playback Sync
        </Title2>
      </div>

      <div className={styles.workspace}>
        <PlaybackSyncRecordingSidebar
          recordings={catalog.recordings}
          assignedPaths={assignedPaths}
          selectedDay={selectedDay}
          isLoading={catalog.isLoading}
          onAssign={handleAssignPath}
          onRefresh={() => void catalog.refresh()}
          onDayChange={setSelectedDay}
          onPreviousDay={() => handleShiftDay(-1)}
          onNextDay={() => handleShiftDay(1)}
        />

        <div className={styles.gridArea}>
          <PlaybackSyncGrid
            controller={controller}
            tileSnapshots={snapshot.tiles}
            slotSpansStatus={slotSpansResults}
          />
        </div>
      </div>

      <PlaybackSyncTimeline
        lanes={lanes}
        dayKey={selectedDay}
        positionMs={sharedTimestampMs}
        onSeek={(epochMs) => controller.seekTo(epochMs)}
      />
      <PlaybackSyncControls controller={controller} />

      <div className={styles.noticeStack}>
        {endpoint.status === 'disabled' && (
          <MessageBar intent="warning" className={styles.notice}>
            <MessageBarBody>
              The playback server is disabled in the MediaMTX configuration.
            </MessageBarBody>
          </MessageBar>
        )}
        {endpoint.status === 'invalid' && (
          <MessageBar intent="error" className={styles.notice}>
            <MessageBarBody>
              The playback server endpoint could not be derived. Configure it in the navigation settings.
            </MessageBarBody>
          </MessageBar>
        )}
        {catalog.isError && (
          <MessageBar intent="error" className={styles.notice}>
            <MessageBarBody>Unable to load the recordings catalog.</MessageBarBody>
          </MessageBar>
        )}
      </div>
    </div>
  );
}
