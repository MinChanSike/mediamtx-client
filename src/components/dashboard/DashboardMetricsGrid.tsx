import { makeStyles, tokens } from '@fluentui/react-components';
import MetricCard from '@src/components/common/MetricCard';
import { useDashboardMetrics } from '@src/hooks/useDashboardMetrics';

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalS,
    '@media (max-width: 1180px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '@media (max-width: 620px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export default function DashboardMetricsGrid() {
  const styles = useStyles();
  const { cards } = useDashboardMetrics();

  return (
    <div className={styles.grid}>
      {cards.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          description={metric.description}
        />
      ))}
    </div>
  );
}
