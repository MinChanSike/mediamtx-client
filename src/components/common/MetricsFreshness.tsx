import { Text, tokens } from "@fluentui/react-components";
import useAppStore from "@src/store/useAppStore";
import useMediaMTXApiStore from "@src/store/useMediaMTXApiStore";

interface MetricsFreshnessProps {
  className?: string;
}

export default function MetricsFreshness({ className }: MetricsFreshnessProps) {
  const serverUrl = useAppStore((state) => state.serverUrl);
  const resource = useMediaMTXApiStore((state) => state.paths);
  const storeUrl = useMediaMTXApiStore((state) => state.serverUrl);
  const status = useMediaMTXApiStore((state) => state.ratesStatus);
  const current = serverUrl === storeUrl;
  const label =
    !current || status === "unavailable"
      ? "Metrics unavailable"
      : status === "stale"
        ? "Metrics stale"
        : "Metrics updated";
  return (
    <Text
      size={200}
      className={className}
      style={{
        display: "block",
        overflowWrap: "anywhere",
        color: tokens.colorNeutralForeground3,
      }}
    >
      {label}
      {current && resource.lastLoadedAt !== null
        ? ` · Last success ${new Date(resource.lastLoadedAt).toLocaleTimeString()}`
        : ""}
    </Text>
  );
}
