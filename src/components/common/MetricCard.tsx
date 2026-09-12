import { Card, Caption1, Text, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  secondaryValue?: string | number;
  secondaryUnit?: string;
  description?: string;
  compact?: boolean;
}

const useStyles = makeStyles({
  card: {
    minHeight: '104px',
    gap: tokens.spacingVerticalXS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  compactCard: {
    minHeight: '92px',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    gap: tokens.spacingVerticalXXS,
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

export default function MetricCard({
  label,
  value,
  unit,
  secondaryValue,
  secondaryUnit,
  description,
  compact,
}: MetricCardProps) {
  const styles = useStyles();

  return (
    <Card className={mergeClasses(styles.card, compact && styles.compactCard)}>
      <Caption1 className={styles.label}>{label}</Caption1>
      <Text className={styles.valueLine} size={compact ? 500 : 600} weight="semibold">
        {value}
        {unit && (
          <Text className={styles.unit} size={200}>
            {unit}
          </Text>
        )}
        {secondaryValue !== undefined && (
          <>
            <Text className={styles.unit} size={200}>
              ·
            </Text>
            {secondaryValue}
            {secondaryUnit && (
              <Text className={styles.unit} size={200}>
                {secondaryUnit}
              </Text>
            )}
          </>
        )}
      </Text>
      {description && <Caption1 className={styles.description}>{description}</Caption1>}
    </Card>
  );
}
