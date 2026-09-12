import { useMemo } from 'react';
import {
  MessageBar,
  MessageBarBody,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import PlaybackControls from '@src/components/playback/PlaybackControls';
import PlaybackGrid from '@src/components/playback/PlaybackGrid';
import PlaybackRecordingSidebar from '@src/components/playback/PlaybackRecordingSidebar';
import PlaybackTimeline, { type TimelineLane } from '@src/components/playback/PlaybackTimeline';
import { usePlaybackCatalog } from '@src/hooks/usePlaybackCatalog';
import { usePlaybackEndpoint } from '@src/hooks/usePlaybackEndpoint';
import { useSlotSpans } from '@src/hooks/usePlaybackSpans';
import { useRecordedPlayback } from '@src/hooks/useRecordedPlayback';
import usePlaybackStore, {
  PLAYBACK_SLOT_COUNT,
} from '@src/store/usePlaybackStore';
import type { NormalizedSpan } from '@src/utils/playbackIntervals';
import { shiftDayKey } from '@src/utils/playbackTime';

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

export default function PlaybackPage() {
  const styles = useStyles();
  const catalog = usePlaybackCatalog();
  const endpoint = usePlaybackEndpoint();

  const layout = usePlaybackStore((s) => s.layout);
  const slots = usePlaybackStore((s) => s.slots);
  const setSlot = usePlaybackStore((s) => s.setSlot);
  const selectedDay = usePlaybackStore((s) => s.selectedDay);
  const setSelectedDay = usePlaybackStore((s) => s.setSelectedDay);
  const sharedTimestampMs = usePlaybackStore((s) => s.sharedTimestampMs);

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

  const { controller, snapshot } = useRecordedPlayback(spansByPath, endpoint.baseUrl);

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
          Playback
        </Title2>
      </div>

      <div className={styles.workspace}>
        <PlaybackRecordingSidebar
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
          <PlaybackGrid
            controller={controller}
            tileSnapshots={snapshot.tiles}
            slotSpansStatus={slotSpansResults}
          />
        </div>
      </div>

      <PlaybackTimeline
        lanes={lanes}
        dayKey={selectedDay}
        positionMs={sharedTimestampMs}
        onSeek={(epochMs) => controller.seekTo(epochMs)}
      />
      <PlaybackControls controller={controller} />

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
