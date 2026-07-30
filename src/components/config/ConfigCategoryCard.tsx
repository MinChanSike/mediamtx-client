import { Card, Text, Title3, makeStyles, tokens } from '@fluentui/react-components';

export interface ConfigField {
  label: string;
  value: string | number | boolean | undefined | null;
}

interface ConfigCategoryCardProps {
  title: string;
  fields: ConfigField[];
}

const useStyles = makeStyles({
  card: {
    gap: tokens.spacingVerticalS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  title: {
    margin: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    margin: 0,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 1.2fr)',
    gap: tokens.spacingHorizontalS,
    alignItems: 'start',
    paddingTop: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXXS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    ':first-child': {
      borderTopColor: 'transparent',
    },
  },
  label: {
    color: tokens.colorNeutralForeground2,
  },
  value: {
    minWidth: 0,
    margin: 0,
    overflowWrap: 'anywhere',
    textAlign: 'right',
    color: tokens.colorNeutralForeground1,
  },
});

export default function ConfigCategoryCard({ title, fields }: ConfigCategoryCardProps) {
  const styles = useStyles();

  return (
    <Card className={styles.card}>
      <Title3 as="h3" className={styles.title}>
        {title}
      </Title3>
      <dl className={styles.list}>
        {fields.map((field) => (
          <div key={field.label} className={styles.row}>
            <dt>
              <Text className={styles.label}>{field.label}</Text>
            </dt>
            <dd className={styles.value}>
              <Text font="monospace">
                {field.value === null || field.value === undefined ? '-' : String(field.value)}
              </Text>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
