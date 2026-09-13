import { type RefObject } from 'react';
import { Button, Spinner, Text, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import {
  ArrowClockwise24Regular,
  DismissRegular,
  VideoOff16Regular,
  Warning24Regular,
} from '@fluentui/react-icons';

interface PlaybackViewerProps {
  videoRef: RefObject<HTMLVideoElement>;
  sourceUrl: string | null;
  streamName: string | null;
  fileName: string | null;
  isBuffering: boolean;
  hasError: boolean;
  onRetry: () => void;
  onClose: () => void;
}

const useStyles = makeStyles({
  root: {
    position: 'relative',
    display: 'flex',
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  rootHover: {
    ':hover': {
      [`& .playback-viewer-close`]: {
        opacity: '1',
      },
    },
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  closeButton: {
    minWidth: '32px',
    width: '32px',
    height: '32px',
    padding: 0,
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    opacity: 0,
    transitionDuration: tokens.durationNormal,
    transitionProperty: 'opacity',
    transitionTimingFunction: tokens.curveEasyEase,
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    ':hover:active': {
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
  },
  closeLayer: {
    position: 'absolute',
    top: tokens.spacingHorizontalXS,
    right: tokens.spacingHorizontalXS,
    zIndex: 3,
    display: 'flex',
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
  bufferingLayer: {
    zIndex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    color: '#ffffff',
  },
});

/** Video stage for one recorded file, with empty, buffering and error states. */
export default function PlaybackViewer({
  videoRef,
  sourceUrl,
  streamName,
  fileName,
  isBuffering,
  hasError,
  onRetry,
  onClose,
}: PlaybackViewerProps) {
  const styles = useStyles();

  return (
    <div
      className={mergeClasses(styles.root, styles.rootHover)}
      aria-label="Recorded file viewer"
    >
      {sourceUrl === null ? (
        <div className={styles.stateLayer}>
          <VideoOff16Regular />
          <Text>Selected file</Text>
          <Text>Select a recorded video file to play</Text>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            key={sourceUrl}
            src={sourceUrl}
            playsInline
            preload="auto"
            className={styles.video}
            data-recorded-file-video="true"
          />
          <div className={styles.closeLayer}>
            <Button
              appearance="subtle"
              className={mergeClasses('playback-viewer-close', styles.closeButton)}
              icon={<DismissRegular style={{ fontSize: 16 }} />}
              onClick={onClose}
              title="Close player"
              aria-label="Close player"
            />
          </div>
          {isBuffering && !hasError && (
            <div className={mergeClasses(styles.stateLayer, styles.bufferingLayer)}>
              <Spinner />
              <Text>Loading file…</Text>
            </div>
          )}
          {hasError && (
            <div className={styles.stateLayer}>
              <Warning24Regular />
              <Text weight="semibold">File failed to play</Text>
              <Text>
                {streamName ? `${streamName}` : 'The recording'}
                {fileName ? ` • ${fileName}` : ''} could not be played.
              </Text>
              <Button
                appearance="primary"
                icon={<ArrowClockwise24Regular />}
                onClick={onRetry}
              >
                Retry
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
