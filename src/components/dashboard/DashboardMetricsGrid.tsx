import {
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import MetricCard from "@src/components/common/MetricCard";
import { useDashboardMetrics } from "@src/hooks/useDashboardMetrics";
import MetricsFreshness from "@src/components/common/MetricsFreshness";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    gap: tokens.spacingVerticalS,
    position: "relative",
  },
  metricsRow: {
    position: "absolute",
    bottom: "-24px",
    right: 0,
  },
  freshnessRow: {
    display: "flex",
    minHeight: "18px",
    justifyContent: "flex-end",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalS,
    "@media (max-width: 1180px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (max-width: 620px)": {
      gridTemplateColumns: "1fr",
    },
  },
  rates: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    "@media (max-width: 620px)": { gridTemplateColumns: "1fr" },
  },
  protocolsSection: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  protocolsTitle: {
    color: tokens.colorNeutralForeground1,
  },
  protocolGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalS,
    "@media (max-width: 1180px)": {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
    "@media (max-width: 720px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (max-width: 420px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export default function DashboardMetricsGrid() {
  const styles = useStyles();
  const { cards } = useDashboardMetrics();
  const primaryLabels = [
    "Uptime",
    "Active Streams",
    "Total Readers",
    "Ingress",
    "Egress",
  ];
  const primary = primaryLabels.flatMap((label) =>
    cards.filter((card) => card.label === label),
  );
  const protocols = cards.filter((card) => !primaryLabels.includes(card.label));

  return (
    <div className={styles.root}>
      <div className={mergeClasses(styles.freshnessRow, styles.metricsRow)}>
        <MetricsFreshness />
      </div>
      <div className={styles.grid}>
        {primary.slice(0, 3).map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            description={metric.description}
          />
        ))}
      </div>
      <div className={mergeClasses(styles.grid, styles.rates)}>
        {primary.slice(3).map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
      <section
        className={styles.protocolsSection}
        aria-label="Readers by protocol"
      >
        <Text
          as="h2"
          size={300}
          weight="semibold"
          className={styles.protocolsTitle}
        >
          Readers by protocol
        </Text>
        <div className={styles.protocolGrid}>
          {protocols.map((metric) => (
            <MetricCard key={metric.label} compact {...metric} />
          ))}
        </div>
      </section>
    </div>
  );
}
