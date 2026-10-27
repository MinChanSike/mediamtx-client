import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { CircleFilled } from "@fluentui/react-icons";

const useStyles = makeStyles({
  badge: {
    backgroundColor: '#d13438',
    color: '#ffffff',
  },
  recordingIndicator: {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
  },
  recordingDot: {
    width: "8px",
    height: "8px",
    flexShrink: 0,
    color: "#d13438",
    animationName: {
      from: { opacity: 1 },
      "50%": { opacity: 0.25 },
      to: { opacity: 1 },
    },
    animationDuration: "1.2s",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  },
  recordingText: {
    color: "#d13438",
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase100,
  },
});

interface RecordingStatusBadgeProps {
  isRecording: boolean;
  className?: string;
}

export default function RecordingStatusBadge({
  isRecording,
  className = "",
}: RecordingStatusBadgeProps) {
  const styles = useStyles();
  if (!isRecording) return null;

  return (
    <span
      className={mergeClasses(styles.recordingIndicator, className)}
      title="Recording"
      aria-label="Recording"
      data-appearance="filled"
    >
      <CircleFilled className={styles.recordingDot} />
      <span className={styles.recordingText}>REC</span>
    </span>
  );
}
