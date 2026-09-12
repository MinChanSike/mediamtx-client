import { useState } from 'react';
import {
  Button,
  Dropdown,
  Input,
  Label,
  Option,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Pause24Regular, Play24Regular } from '@fluentui/react-icons';
import type { RecordedPlaybackController } from '@src/playback/recordedPlaybackController';
import usePlaybackStore, {
  PLAYBACK_RATES,
  type PlaybackRate,
} from '@src/store/usePlaybackStore';
import {
  formatLocalTimeOfDay,
  getDayRangeMs,
  parseLocalTimeOfDay,
} from '@src/utils/playbackTime';

interface PlaybackControlsProps {
  controller: RecordedPlaybackController;
}

const useStyles = makeStyles({
  root: {
    boxSizing: 'border-box',
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalXS,
    minHeight: '48px',
    flexShrink: 0,
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    '@media (max-width: 760px)': {
      justifyContent: 'space-between',
      paddingLeft: tokens.spacingHorizontalS,
      paddingRight: tokens.spacingHorizontalS,
    },
  },
  transportGroup: {
    display: 'flex',
    minWidth: 0,
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  leadingSpacer: {
    flex: 1.25,
    '@media (max-width: 760px)': {
      display: 'none',
    },
  },
  trailingSpacer: {
    flex: 1,
    '@media (max-width: 760px)': {
      display: 'none',
    },
  },
  transportButton: {
    minWidth: '72px',
    '@media (max-width: 760px)': {
      minWidth: '56px',
    },
  },
  rateGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  rateDropdown: {
    minWidth: '76px',
    width: '76px',
  },
  timestampField: {
    flex: '0 1 128px',
    minWidth: '104px',
  },
  timestampInput: {
    fontFamily: tokens.fontFamilyMonospace,
  },
  status: {
    position: 'absolute',
    overflow: 'hidden',
    width: '1px',
    height: '1px',
    clip: 'rect(0 0 0 0)',
  },
});

function formatRateLabel(rate: PlaybackRate): string {
  return `${rate}x`;
}

/**
 * Shared transport controls: play/pause, seek ±10 seconds, playback rate
 * (0.5x/1x/2x/4x) and direct timestamp entry, all acting on the shared
 * clock so every tile stays aligned.
 */
export default function PlaybackControls({ controller }: PlaybackControlsProps) {
  const styles = useStyles();

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const rate = usePlaybackStore((s) => s.rate);
  const setRate = usePlaybackStore((s) => s.setRate);
  const sharedTimestampMs = usePlaybackStore((s) => s.sharedTimestampMs);
  const selectedDay = usePlaybackStore((s) => s.selectedDay);

  const [timestampDraft, setTimestampDraft] = useState<string | null>(null);
  const displayTime = formatLocalTimeOfDay(sharedTimestampMs);

  const dayRange = getDayRangeMs(selectedDay);

  const commitTimestamp = () => {
    if (timestampDraft === null) return;
    const parsed = parseLocalTimeOfDay(timestampDraft, selectedDay);
    setTimestampDraft(null);
    if (parsed !== null && dayRange) {
      const clamped = Math.min(
        Math.max(parsed, dayRange.startMs),
        dayRange.endMs - 1
      );
      controller.seekTo(clamped);
    }
  };

  const handleTogglePlay = () => {
    if (controller.isPlaying()) {
      controller.pause();
      setIsPlaying(false);
    } else {
      controller.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className={styles.root} aria-label="Playback controls">
      <div className={styles.leadingSpacer} aria-hidden="true" />
      <div className={styles.transportGroup} role="group" aria-label="Transport">
        <Button
          className={styles.transportButton}
          appearance="secondary"
          onClick={() => controller.nudge(-10)}
          aria-label="Seek back 10 seconds"
        >
          −10s
        </Button>
        <Button
          className={styles.transportButton}
          appearance="primary"
          icon={isPlaying ? <Pause24Regular /> : <Play24Regular />}
          onClick={handleTogglePlay}
          aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button
          className={styles.transportButton}
          appearance="secondary"
          onClick={() => controller.nudge(10)}
          aria-label="Seek forward 10 seconds"
        >
          +10s
        </Button>
      </div>

      <Input
        type="time"
        step={1}
        className={styles.timestampField}
        input={{ className: styles.timestampInput }}
        aria-label="Seek to timestamp"
        value={timestampDraft ?? displayTime}
        onFocus={() => setTimestampDraft(displayTime)}
        onChange={(_event, data) => setTimestampDraft(data.value)}
        onBlur={commitTimestamp}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitTimestamp();
          } else if (event.key === 'Escape') {
            setTimestampDraft(null);
          }
        }}
      />

      <div className={styles.trailingSpacer} aria-hidden="true" />

      <div className={styles.rateGroup}>
        <Label htmlFor="playback-rate">Rate</Label>
        <Dropdown
          id="playback-rate"
          className={styles.rateDropdown}
          value={formatRateLabel(rate)}
          aria-label="Playback rate"
          onOptionSelect={(_event, data) => {
            const nextRate = Number(data.optionValue) as PlaybackRate;
            setRate(nextRate);
          }}
        >
          {PLAYBACK_RATES.map((option) => (
            <Option key={option} value={String(option)}>
              {formatRateLabel(option)}
            </Option>
          ))}
        </Dropdown>
      </div>

      <Text size={100} className={styles.status}>
        {isPlaying ? 'Playing' : 'Paused'} at {displayTime} • {rate}x
      </Text>
    </div>
  );
}
