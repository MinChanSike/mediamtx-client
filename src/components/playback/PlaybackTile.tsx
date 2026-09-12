import { useEffect, useRef } from 'react';
import {
  Badge,
  Button,
  Spinner,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowClockwise24Regular,
  CalendarEmpty24Regular,
  DismissRegular,
  Speaker224Regular,
  SpeakerMute24Regular,
  VideoOff16Regular,
  Warning24Regular,
} from '@fluentui/react-icons';
import type {
  RecordedPlaybackController,
  TileSnapshot,
} from '@src/playback/recordedPlaybackController';
import usePlaybackStore from '@src/store/usePlaybackStore';
import useCloseButtonStyles from '@src/components/common/useCloseButtonStyles';

interface PlaybackTileProps {
  slot: number;
  path: string | null;
  controller: RecordedPlaybackController;
  tile: TileSnapshot | undefined;
  spansError: Error | null;
  spansLoading: boolean;
}

const useStyles = makeStyles({
  root: {
    position: 'relative',
    display: 'flex',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  overlay: {
    pointerEvents: 'auto',
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalXS,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    padding: `2px ${tokens.spacingHorizontalXS}`,
    color: '#ffffff',
    opacity: 0,
    transitionDuration: tokens.durationNormal,
    transitionProperty: 'opacity',
    transitionTimingFunction: tokens.curveEasyEase,
    ':hover': {
      opacity: 1,
    },
  },
  rootHoverOverlay: {
    ':hover': {
      [`& .playback-tile-overlay`]: {
        opacity: 1,
      },
    },
  },
  title: {
    display: 'flex',
    minWidth: 0,
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  titleText: {
    color: '#ffffff',
    fontFamily: tokens.fontFamilyMonospace,
  },
  overlayButton: {
    pointerEvents: 'auto',
    flexShrink: 0,
    minWidth: '32px',
    width: '32px',
    height: '32px',
    padding: 0,
    color: '#ffffff',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    ':hover:active': {
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
  },
  stateLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    textAlign: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground2,
  },
  stateLayerDark: {
    backgroundColor: '#000000',
    color: '#ffffff',
  },
  bufferingBadge: {
    position: 'absolute',
    right: tokens.spacingHorizontalS,
    bottom: tokens.spacingVerticalS,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    color: '#ffffff',
    padding: `2px ${tokens.spacingHorizontalXS}`,
  },
});

function tileMessage(tile: TileSnapshot, slot: number): { title: string; detail: string } {
  switch (tile.status) {
    case 'no-recording':
      return {
        title: 'No recordings for this day',
        detail: 'This path has no recorded footage on the selected day.',
      };
    case 'gap':
      return {
        title: 'No footage at this time',
        detail: 'The shared timestamp falls in a recording gap for this camera.',
      };
    case 'error':
      return {
        title: tile.errorCode === 'endpoint' ? 'Playback server unavailable' : 'Tile failed',
        detail: tile.errorMessage ?? 'The recording could not be played.',
      };
    default:
      return { title: `Slot ${slot + 1}`, detail: 'Loading recording…' };
  }
}

/**
 * One recorded-playback tile: a native `<video>` element driven by the grid
 * controller, with independent loading, gap, no-recording, decode-error and
 * retry states so a failing tile never disturbs the rest of the grid.
 */
export default function PlaybackTile({
  slot,
  path,
  controller,
  tile,
  spansError,
  spansLoading,
}: PlaybackTileProps) {
  const styles = useStyles();
  const closeButtonStyles = useCloseButtonStyles();
  const videoRef = useRef<HTMLVideoElement>(null);

  const audioSlot = usePlaybackStore((s) => s.audioSlot);
  const setAudioSlot = usePlaybackStore((s) => s.setAudioSlot);
  const clearSlot = usePlaybackStore((s) => s.clearSlot);

  useEffect(() => {
    const video = videoRef.current;
    if (!path || !video) return;
    controller.attachVideo(slot, path, video);
    return () => controller.detachVideo(slot);
  }, [controller, slot, path]);

  if (!path) {
    return (
      <div className={styles.root} aria-label={`Playback slot ${slot + 1}, empty`}>
        <div className={styles.stateLayer}>
          <VideoOff16Regular />
          <Text>Slot {slot + 1}</Text>
          <Text>Assign a recorded path to start playback</Text>
        </div>
      </div>
    );
  }

  const effectiveTile: TileSnapshot =
    spansError && (!tile || tile.status === 'loading')
      ? {
          status: 'error',
          errorCode: 'network',
          errorMessage: 'Interval availability could not be loaded from the playback server.',
          isBuffering: false,
        }
      : (tile ?? {
          status: spansLoading ? 'loading' : 'idle',
          errorCode: null,
          errorMessage: null,
          isBuffering: false,
        });

  const showStateLayer =
    effectiveTile.status !== 'ready' &&
    effectiveTile.status !== 'loading' &&
    effectiveTile.status !== 'idle';

  const message = tileMessage(effectiveTile, slot);
  const isAudioSelected = audioSlot === slot;

  return (
    <div
      className={mergeClasses(styles.root, styles.rootHoverOverlay)}
      aria-label={`Playback slot ${slot + 1}, ${path}`}
    >
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        className={styles.video}
        data-playback-tile={slot}
      />

      {effectiveTile.status === 'loading' && (
        <div className={mergeClasses(styles.stateLayer, styles.stateLayerDark)}>
          <Spinner />
          <Text>Loading recording…</Text>
        </div>
      )}

      {showStateLayer && (
        <div className={styles.stateLayer}>
          {effectiveTile.status === 'no-recording' ? (
            <CalendarEmpty24Regular />
          ) : (
            <Warning24Regular />
          )}
          <Text weight="semibold">
            {message.title}
          </Text>
          <Text>{message.detail}</Text>
          {effectiveTile.status === 'error' && (
            <Button
              appearance="primary"
              icon={<ArrowClockwise24Regular />}
              onClick={() => controller.retryTile(slot)}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {effectiveTile.isBuffering && effectiveTile.status === 'ready' && (
        <Badge appearance="filled" className={styles.bufferingBadge}>
          Buffering
        </Badge>
      )}

      <div className={mergeClasses('playback-tile-overlay', styles.overlay)}>
        <div className={styles.title}>
          <Text truncate className={styles.titleText}>
            {path}
          </Text>
        </div>
        <div className={styles.title}>
          <Button
            appearance="subtle"
            className={styles.overlayButton}
            icon={
              isAudioSelected ? <SpeakerMute24Regular /> : <Speaker224Regular />
            }
            onClick={() => setAudioSlot(isAudioSelected ? null : slot)}
            title={isAudioSelected ? 'Mute this tile' : 'Listen to this tile (mutes others)'}
            aria-label={isAudioSelected ? `Mute tile ${slot + 1}` : `Listen to tile ${slot + 1}`}
          />
          <Button
            appearance="subtle"
            className={mergeClasses(styles.overlayButton, closeButtonStyles.dangerHover)}
            icon={<DismissRegular style={{ fontSize: 16 }} />}
            onClick={() => clearSlot(slot)}
            title="Remove from grid"
            aria-label={`Remove tile ${slot + 1}`}
          />
        </div>
      </div>
    </div>
  );
}
