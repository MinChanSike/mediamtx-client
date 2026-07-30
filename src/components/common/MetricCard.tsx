import { Card, Caption1, Text, makeStyles, tokens } from '@fluentui/react-components';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  description?: string;
}

const useStyles = makeStyles({
  card: {
    minHeight: '104px',
    gap: tokens.spacingVerticalXS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  label: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0',
  },
  valueLine: {
    display: 'flex',
    minWidth: 0,
    alignItems: 'baseline',
    gap: tokens.spacingHorizontalXXS,
    color: tokens.colorNeutralForeground1,
  },
  unit: {
    color: tokens.colorNeutralForeground3,
  },
  description: {
    marginTop: 'auto',
    color: tokens.colorNeutralForeground3,
  },
});

export default function MetricCard({ label, value, unit, description }: MetricCardProps) {
  const styles = useStyles();

  return (
    <Card className={styles.card}>
      <Caption1 className={styles.label}>{label}</Caption1>
      <Text className={styles.valueLine} size={600} weight="semibold">
        {value}
        {unit && (
          <Text className={styles.unit} size={200}>
            {unit}
          </Text>
        )}
      </Text>
      {description && <Caption1 className={styles.description}>{description}</Caption1>}
    </Card>
  );
}
