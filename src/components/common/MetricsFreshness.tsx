import { useState } from "react";
import {
  Button,
  makeStyles,
  mergeClasses,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwise16Regular } from "@fluentui/react-icons";
import useAppStore from "@src/store/useAppStore";
import useMediaMTXApiStore from "@src/store/useMediaMTXApiStore";
import { refreshMetricsNow } from "@src/hooks/useMediaMTXApi";

interface MetricsFreshnessProps {
  className?: string;
}

const useStyles = makeStyles({
  root: {
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
  },
  refreshButton: {
    minWidth: "auto",
    width: "20px",
    height: "20px",
    minHeight: "20px",
    padding: 0,
    color: tokens.colorNeutralForeground3,
    ":hover": {
      color: tokens.colorNeutralForeground1,
    },
  },
  text: {
    display: "block",
    overflowWrap: "anywhere",
    color: tokens.colorNeutralForeground3,
  },
});

export default function MetricsFreshness({ className }: MetricsFreshnessProps) {
  const styles = useStyles();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const serverUrl = useAppStore((state) => state.serverUrl);
  const resource = useMediaMTXApiStore((state) => state.paths);
  const storeUrl = useMediaMTXApiStore((state) => state.serverUrl);
  const status = useMediaMTXApiStore((state) => state.ratesStatus);
  const current = serverUrl === storeUrl;
  const isBusy =
    isManualRefreshing || resource.isRefreshing || resource.isLoading;

  const label =
    !current || status === "unavailable"
      ? "Metrics unavailable"
      : status === "stale"
        ? "Metrics stale"
        : "Metrics updated";

  const handleRefresh = async () => {
    if (isBusy || !serverUrl || !current) return;
    setIsManualRefreshing(true);
    try {
      await refreshMetricsNow();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  return (
    <div className={mergeClasses(styles.root, className)}>
      <Button
        appearance="subtle"
        size="small"
        icon={<ArrowClockwise16Regular />}
        aria-label="Refresh metrics"
        title="Refresh metrics"
        disabled={isBusy || !serverUrl || !current}
        onClick={() => void handleRefresh()}
        className={styles.refreshButton}
      />
      <Text size={200} className={styles.text}>
        {label}
        {current && resource.lastLoadedAt !== null
          ? ` · Last success ${new Date(resource.lastLoadedAt).toLocaleTimeString()}`
          : ""}
      </Text>
    </div>
  );
}
