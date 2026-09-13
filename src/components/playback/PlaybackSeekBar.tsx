import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { formatFilePosition } from "@src/utils/recordedFileFormat";

interface PlaybackSeekBarProps {
  videoRef: RefObject<HTMLVideoElement>;
  /**
   * Full recorded length of the selected file. The catalog value is used even
   * before the browser finishes parsing the streamed fMP4, so the bar always
   * spans the whole recording.
   */
  fullDurationMs: number;
  /** File-relative start of the currently loaded bounded window. */
  windowStartMs: number;
  isDisabled: boolean;
  /** Changes whenever a different window or file loads; resets the bar. */
  resetKey: string | null;
  onSeek: (positionMs: number) => void;
}

const useStyles = makeStyles({
  root: {
    boxSizing: "border-box",
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    userSelect: "none",
    WebkitUserSelect: "none",
  },
  timeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS,
  },
  timeLabel: {
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground2,
  },
  track: {
    position: "relative",
    height: "20px",
    flexShrink: 0,
    minWidth: 0,
    cursor: "pointer",
    touchAction: "none",
  },
  rail: {
    position: "absolute",
    top: "8px",
    right: 0,
    left: 0,
    height: "4px",
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralStrokeAccessible,
  },
  fill: {
    position: "absolute",
    top: "8px",
    left: 0,
    height: "4px",
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorBrandForeground1,
  },
  thumb: {
    position: "absolute",
    top: "4px",
    width: "12px",
    height: "12px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandForeground1,
    boxShadow: `0 0 0 2px ${tokens.colorNeutralBackground1}`,
    transform: "translateX(-50%)",
  },
  disabled: {
    opacity: 0.4,
    cursor: "default",
  },
});

function positionToMs(
  clientX: number,
  track: HTMLElement,
  durationMs: number,
): number {
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return Math.round(ratio * durationMs);
}

/**
 * Seekable timeline for the currently playing recorded file. The labels sit on
 * their own row so the track shares its left edge with the toolbar content
 * below and the video above. Position tracking runs on a requestAnimationFrame
 * loop while the video plays, so the bar stays smooth at any playback rate;
 * `seeked`/`timeupdate` listeners keep it correct for external seeks and while
 * the tab is backgrounded (where rAF pauses).
 */
export default function PlaybackSeekBar({
  videoRef,
  fullDurationMs,
  windowStartMs,
  isDisabled,
  resetKey,
  onSeek,
}: PlaybackSeekBarProps) {
  const styles = useStyles();
  const trackRef = useRef<HTMLDivElement>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [previewMs, setPreviewMs] = useState<number | null>(null);
  const previewRef = useRef<number | null>(null);

  const setPreview = (value: number | null) => {
    previewRef.current = value;
    setPreviewMs(value);
  };

  useEffect(() => {
    const video = videoRef.current;
    setPositionMs(windowStartMs);
    setPreview(null);
    if (!video) return;

    let rafId = 0;
    const sample = () => {
      if (previewRef.current === null) {
        setPositionMs(windowStartMs + Math.round(video.currentTime * 1000));
      }
    };
    const tick = () => {
      sample();
      rafId = requestAnimationFrame(tick);
    };
    const startLoop = () => {
      if (rafId === 0) rafId = requestAnimationFrame(tick);
    };
    const stopLoop = () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      sample();
    };

    video.addEventListener("play", startLoop);
    video.addEventListener("playing", startLoop);
    video.addEventListener("pause", stopLoop);
    video.addEventListener("ended", stopLoop);
    video.addEventListener("seeked", sample);
    video.addEventListener("timeupdate", sample);
    if (!video.paused && !video.ended) startLoop();

    return () => {
      stopLoop();
      video.removeEventListener("play", startLoop);
      video.removeEventListener("playing", startLoop);
      video.removeEventListener("pause", stopLoop);
      video.removeEventListener("ended", stopLoop);
      video.removeEventListener("seeked", sample);
      video.removeEventListener("timeupdate", sample);
    };
  }, [videoRef, resetKey, windowStartMs]);

  const effectiveDuration = Math.max(0, fullDurationMs);
  const effectivePosition = Math.min(
    previewMs ?? positionMs,
    effectiveDuration || Infinity,
  );
  const progressRatio =
    effectiveDuration > 0
      ? Math.min(1, effectivePosition / effectiveDuration)
      : 0;

  const commitPreview = () => {
    // Read the ref, not the state: a pointerup in the same tick as pointerdown
    // would otherwise see a stale null preview and never commit.
    if (previewRef.current !== null) {
      onSeek(previewRef.current);
    }
    setPreview(null);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isDisabled || !trackRef.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPreview(
      positionToMs(event.clientX, trackRef.current, effectiveDuration),
    );
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (previewMs === null || !trackRef.current) return;
    setPreview(
      positionToMs(event.clientX, trackRef.current, effectiveDuration),
    );
  };

  const handlePointerUp = () => commitPreview();

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isDisabled || effectiveDuration === 0) return;
    const step = event.shiftKey ? 30_000 : 5_000;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onSeek(Math.min(effectiveDuration, positionMs + step));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSeek(Math.max(0, positionMs - step));
    } else if (event.key === "Home") {
      event.preventDefault();
      onSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onSeek(effectiveDuration);
    }
  };

  return (
    <div className={styles.root} aria-label="Recorded file timeline">
      <div className={styles.timeRow}>
        <Text size={100} className={styles.timeLabel}>
          {formatFilePosition(effectiveDuration > 0 ? effectivePosition : 0)}
        </Text>
        <Text size={100} className={styles.timeLabel}>
          {formatFilePosition(effectiveDuration)}
        </Text>
      </div>
      <div
        ref={trackRef}
        className={mergeClasses(styles.track, isDisabled && styles.disabled)}
        role="slider"
        aria-label="Seek position"
        aria-valuemin={0}
        aria-valuemax={Math.round(effectiveDuration / 1000)}
        aria-valuenow={Math.round(effectivePosition / 1000)}
        aria-disabled={isDisabled}
        tabIndex={isDisabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.rail} />
        <div
          className={styles.fill}
          style={{ width: `${progressRatio * 100}%` }}
        />
        <div
          className={styles.thumb}
          style={{ left: `${progressRatio * 100}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
