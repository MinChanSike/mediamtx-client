import { Badge, makeStyles } from "@fluentui/react-components";
import { RecordRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  badge: {
    backgroundColor: '#d13438',
    color: '#ffffff',
  },
  recordingActiveIcon: {
    animationName: {
      from: { opacity: 1 },
      "50%": { opacity: 0.25 },
      to: { opacity: 1 },
    },
    animationDuration: "1.2s",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  },
});

interface RecordingStatusBadgeProps {
  isRecording: boolean;
  className?: string;
}

export default function RecordingStatusBadge({
  isRecording,
  className = '',
}: RecordingStatusBadgeProps) {
  const styles = useStyles();
  if (!isRecording) return null;

  return (
    <Badge appearance="filled" className={`${styles.badge} ${className}`.trim()} shape="circular">
      <RecordRegular className={styles.recordingActiveIcon} /> Recording
    </Badge>
  );
}
