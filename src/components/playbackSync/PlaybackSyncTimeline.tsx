import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Text, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import type { NormalizedSpan } from '@src/utils/playbackIntervals';
import { clipSpansToRange, findSpanAt } from '@src/utils/playbackIntervals';
import { formatLocalTimeOfDay, getDayRangeMs } from '@src/utils/playbackTime';

export interface TimelineLane {
  slot: number;
  path: string | null;
  spans: NormalizedSpan[] | undefined;
}

interface PlaybackTimelineProps {
  lanes: TimelineLane[];
  dayKey: string;
  positionMs: number;
  onSeek: (epochMs: number) => void;
}

const useStyles = makeStyles({
  root: {
    boxSizing: 'border-box',
    display: 'flex',
    height: '108px',
    minHeight: '108px',
    flexShrink: 0,
    flexDirection: 'column',
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  track: {
    position: 'relative',
    display: 'flex',
    minHeight: 0,
    flex: 1,
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  ruler: {
    position: 'relative',
    height: '18px',
    flexShrink: 0,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
  },
  rulerTick: {
    position: 'absolute',
    top: 0,
    transform: 'translateX(-50%)',
    paddingRight: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalXS,
    whiteSpace: 'nowrap',
    '@media (max-width: 720px)': {
      ':nth-child(even)': {
        display: 'none',
      },
    },
  },
  lanes: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  lane: {
    position: 'relative',
    height: '14px',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  laneLabel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    display: 'flex',
    alignItems: 'center',
    maxWidth: '30%',
    zIndex: 1,
    overflow: 'hidden',
    paddingLeft: tokens.spacingHorizontalXS,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    color: tokens.colorNeutralForeground3,
    pointerEvents: 'none',
    textShadow: `0 0 4px ${tokens.colorNeutralBackground1}`,
    whiteSpace: 'nowrap',
  },
  coverage: {
    position: 'absolute',
    top: '2px',
    bottom: '2px',
    borderRadius: '2px',
    backgroundColor: tokens.colorPaletteGreenForeground2,
  },
  coverageActive: {
    backgroundColor: tokens.colorPaletteLightGreenForeground1,
    outline: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralForeground1}`,
  },
  cursor: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2px',
    marginLeft: '-1px',
    zIndex: 2,
    backgroundColor: tokens.colorBrandForeground1,
    pointerEvents: 'none',
  },
  cursorTime: {
    position: 'absolute',
    bottom: 0,
    transform: 'translateX(-50%)',
    zIndex: 2,
    paddingRight: tokens.spacingHorizontalS,
    paddingLeft: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    lineHeight: tokens.lineHeightBase100,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  preview: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '1px',
    zIndex: 2,
    backgroundColor: tokens.colorNeutralForeground3,
    pointerEvents: 'none',
  },
  emptyLanes: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '32px',
    color: tokens.colorNeutralForeground3,
  },
});

const HOUR_LABEL_STEP = 3;

function percentOf(value: number, startMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return ((value - startMs) / totalMs) * 100;
}

/**
 * Shared surveillance-style timeline for the selected day. Each assigned
 * stream renders an availability lane with visible gaps; the shared cursor
 * tracks the shared clock and supports click and drag seeking.
 */
export default function PlaybackTimeline({ lanes, dayKey, positionMs, onSeek }: PlaybackTimelineProps) {
  const styles = useStyles();
  const trackRef = useRef<HTMLDivElement>(null);
  // The ref tracks the active scrub synchronously so a pointerup in the same
  // batch as its pointerdown still commits; state only drives rendering.
  const previewRef = useRef<number | null>(null);
  const [previewMs, setPreviewMs] = useState<number | null>(null);

  const setPreview = useCallback((targetMs: number | null) => {
    previewRef.current = targetMs;
    setPreviewMs(targetMs);
  }, []);

  const dayRange = getDayRangeMs(dayKey);
  const startMs = dayRange?.startMs ?? 0;
  const totalMs = dayRange ? dayRange.endMs - dayRange.startMs : 0;

  const positionToMs = useCallback(
    (clientX: number): number | null => {
      const track = trackRef.current;
      if (!track || totalMs <= 0) return null;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const ratio = (clientX - rect.left) / rect.width;
      return startMs + Math.min(Math.max(ratio, 0), 1) * totalMs;
    },
    [startMs, totalMs]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const targetMs = positionToMs(event.clientX);
    if (targetMs === null) return;

    // Pointer capture keeps drag tracking on the track; synthetic or
    // interrupted pointers may reject it, so seeking must not depend on it.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Drag tracking falls back to move events on the track itself.
    }
    setPreview(targetMs);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (previewRef.current === null) return;
    const targetMs = positionToMs(event.clientX);
    if (targetMs !== null) setPreview(targetMs);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (previewRef.current === null) return;
    const targetMs = positionToMs(event.clientX);
    setPreview(null);
    if (targetMs !== null) onSeek(targetMs);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (totalMs <= 0) return;
    const stepMs = event.shiftKey ? 10 * 60 * 1000 : 60 * 1000;
    let targetMs: number | null = null;

    if (event.key === 'ArrowLeft') targetMs = positionMs - stepMs;
    else if (event.key === 'ArrowRight') targetMs = positionMs + stepMs;
    else if (event.key === 'Home') targetMs = startMs;
    else if (event.key === 'End') targetMs = startMs + totalMs - 1;

    if (targetMs === null) return;
    event.preventDefault();
    onSeek(Math.min(Math.max(targetMs, startMs), startMs + totalMs - 1));
  };

  const assignedLanes = lanes.filter((lane) => lane.path !== null);

  const cursorPercent = percentOf(positionMs, startMs, totalMs);
  const previewPercent =
    previewMs !== null ? percentOf(previewMs, startMs, totalMs) : null;
  const cursorLabelMs = previewMs !== null ? previewMs : positionMs;

  const hourMarks = useMemo(() => {
    const marks: Array<{ hour: number; label: string }> = [];
    for (let hour = 0; hour <= 24; hour += 1) {
      const isEnd = hour === 24;
      if (!isEnd && hour % HOUR_LABEL_STEP !== 0) continue;
      marks.push({
        hour,
        label: isEnd
          ? '24:00'
          : `${`${hour}`.padStart(2, '0')}:00`,
      });
    }
    return marks;
  }, []);

  return (
    <div className={styles.root} aria-label="Recording availability timeline">
      <div
        ref={trackRef}
        className={styles.track}
        role="slider"
        tabIndex={0}
        aria-label="Shared playback position"
        aria-valuemin={Math.round(startMs / 1000)}
        aria-valuemax={Math.round((startMs + totalMs) / 1000)}
        aria-valuenow={Math.round(positionMs / 1000)}
        aria-valuetext={formatLocalTimeOfDay(positionMs)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setPreview(null)}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.ruler}>
          {hourMarks.map((mark) => (
            <span
              key={mark.hour}
              className={styles.rulerTick}
              style={{ left: `${(mark.hour / 24) * 100}%` }}
            >
              {mark.label}
            </span>
          ))}
        </div>

        <div className={styles.lanes}>
          {assignedLanes.length === 0 ? (
            <Text size={200} className={styles.emptyLanes}>
              Assign recorded paths to see their availability
            </Text>
          ) : (
            assignedLanes.map((lane) => {
              const clipped = lane.spans
                ? clipSpansToRange(lane.spans, startMs, startMs + totalMs)
                : [];
              const activeSpan = lane.spans ? findSpanAt(lane.spans, positionMs) : null;

              return (
                <div
                  key={lane.slot}
                  className={styles.lane}
                  aria-label={`Availability for ${lane.path}`}
                >
                  <span className={styles.laneLabel}>{lane.path}</span>
                  {clipped.map((block, index) => {
                    const isActive = activeSpan === block.source;
                    return (
                      <div
                        key={`${block.source.startMs}-${index}`}
                        className={mergeClasses(styles.coverage, isActive && styles.coverageActive)}
                        style={{
                          left: `${percentOf(block.startMs, startMs, totalMs)}%`,
                          width: `${percentOf(block.endMs, startMs, totalMs) - percentOf(block.startMs, startMs, totalMs)}%`,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {previewPercent !== null && (
          <div className={styles.preview} style={{ left: `${previewPercent}%` }} />
        )}
        <div className={styles.cursor} style={{ left: `${cursorPercent}%` }} />
        <span className={styles.cursorTime} style={{ left: `${cursorPercent}%` }}>
          {formatLocalTimeOfDay(cursorLabelMs)}
        </span>
      </div>
    </div>
  );
}
