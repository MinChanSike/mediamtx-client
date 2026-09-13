import { Badge, makeStyles } from "@fluentui/react-components";
import { RecordRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
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
}: RecordingStatusBadgeProps) {
  const styles = useStyles();
  if (!isRecording) return null;

  return (
    <Badge appearance="tint" color="danger" shape="circular">
      <RecordRegular className={styles.recordingActiveIcon} /> Recording
    </Badge>
  );
}
