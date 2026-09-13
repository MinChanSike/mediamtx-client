import {
  Button,
  Label,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowForwardFilled,
  ArrowNext24Regular,
  ArrowPrevious24Regular,
  Pause24Regular,
  Play24Regular,
} from "@fluentui/react-icons";
import { PLAYBACK_RATES, type PlaybackRate } from "@src/store/usePlaybackStore";
import { formatFileRecordedAt } from "@src/utils/recordedFileFormat";

interface PlaybackToolbarProps {
  streamName: string | null;
  fileStartMs: number | null;
  isDisabled: boolean;
  isPlaying: boolean;
  hasPreviousFile: boolean;
  hasNextFile: boolean;
  rate: PlaybackRate;
  onTogglePlay: () => void;
  onSeekRelative: (deltaSeconds: number) => void;
  onPreviousFile: () => void;
  onNextFile: () => void;
  onRateChange: (rate: PlaybackRate) => void;
}

const useStyles = makeStyles({
  root: {
    boxSizing: "border-box",
    display: "flex",
    flexWrap: "wrap",
    rowGap: tokens.spacingVerticalXS,
    minHeight: "52px",
    flexShrink: 0,
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    "@media (max-width: 760px)": {
      justifyContent: "space-between",
      paddingLeft: tokens.spacingHorizontalS,
      paddingRight: tokens.spacingHorizontalS,
    },
  },
  fileInfo: {
    display: "flex",
    minWidth: "220px",
    flex: "0 1 320px",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  fileStream: {
    maxWidth: "100%",
    fontFamily: tokens.fontFamilyMonospace,
    lineHeight: tokens.lineHeightBase200,
  },
  fileRecorded: {
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase100,
  },
  spacer: {
    flex: 1,
    "@media (max-width: 760px)": {
      display: "none",
    },
  },
  transportGroup: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  transportButton: {
    minWidth: "44px",
    "@media (max-width: 760px)": {
      minWidth: "36px",
    },
  },
  playButton: {
    width: "104px",
    minWidth: "104px",
  },
  seekBackIcon: {
    transform: "scaleX(-1)",
  },
  rateGroup: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  rateLabel: {
    marginRight: tokens.spacingHorizontalS,
  },
  rateButton: {
    minWidth: "36px",
  },
});

function formatRateLabel(rate: PlaybackRate): string {
  return `${rate}x`;
}

/** Bottom transport: file details, play controls, file skipping, and rate. */
export default function PlaybackToolbar({
  streamName,
  fileStartMs,
  isDisabled,
  isPlaying,
  hasPreviousFile,
  hasNextFile,
  rate,
  onTogglePlay,
  onSeekRelative,
  onPreviousFile,
  onNextFile,
  onRateChange,
}: PlaybackToolbarProps) {
  const styles = useStyles();

  return (
    <div className={styles.root} aria-label="Recorded file controls">
      <div className={styles.fileInfo}>
        <Text className={styles.fileStream} weight="semibold" truncate>
          {streamName ?? "No file selected"}
        </Text>
        <Text className={styles.fileRecorded} size={100}>
          {fileStartMs === null
            ? "Pick a recorded file to see its details"
            : `Recorded at ${formatFileRecordedAt(fileStartMs)}`}
        </Text>
      </div>

      <div className={styles.spacer} aria-hidden="true" />

      <div
        className={styles.transportGroup}
        role="group"
        aria-label="Transport"
      >
        <Tooltip content="Previous file" relationship="label">
          <Button
            className={styles.transportButton}
            appearance="secondary"
            icon={<ArrowPrevious24Regular />}
            disabled={isDisabled || !hasPreviousFile}
            onClick={onPreviousFile}
            aria-label="Play previous file"
          />
        </Tooltip>
        <Tooltip content="Back 10 seconds" relationship="label">
          <Button
            className={styles.transportButton}
            appearance="secondary"
            icon={<ArrowForwardFilled className={styles.seekBackIcon} />}
            disabled={isDisabled}
            onClick={() => onSeekRelative(-10)}
            aria-label="Seek back 10 seconds"
          />
        </Tooltip>
        <Button
          className={styles.playButton}
          appearance="primary"
          icon={isPlaying ? <Pause24Regular /> : <Play24Regular />}
          disabled={isDisabled}
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause playback" : "Play playback"}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <Tooltip content="Forward 10 seconds" relationship="label">
          <Button
            className={styles.transportButton}
            appearance="secondary"
            icon={<ArrowForwardFilled />}
            disabled={isDisabled}
            onClick={() => onSeekRelative(10)}
            aria-label="Seek forward 10 seconds"
          />
        </Tooltip>
        <Tooltip content="Next file" relationship="label">
          <Button
            className={styles.transportButton}
            appearance="secondary"
            icon={<ArrowNext24Regular />}
            disabled={isDisabled || !hasNextFile}
            onClick={onNextFile}
            aria-label="Play next file"
          />
        </Tooltip>
      </div>

      <div className={styles.spacer} aria-hidden="true" />

      <div className={styles.rateGroup} role="group" aria-label="Playback rate">
        <Label className={styles.rateLabel}>Rate</Label>
        {PLAYBACK_RATES.map((option) => (
          <Button
            key={option}
            size="small"
            className={styles.rateButton}
            appearance={option === rate ? "primary" : "secondary"}
            aria-label={`Set playback rate ${formatRateLabel(option)}`}
            aria-pressed={option === rate}
            disabled={isDisabled}
            onClick={() => onRateChange(option)}
          >
            {formatRateLabel(option)}
          </Button>
        ))}
      </div>
    </div>
  );
}
