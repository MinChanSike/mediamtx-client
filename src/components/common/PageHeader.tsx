import type { ReactNode } from 'react';
import { Text, Title2, makeStyles, tokens } from '@fluentui/react-components';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL,
    '@media (max-width: 900px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
  },
  copy: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    minWidth: 0,
  },
  title: {
    display: 'block',
    marginTop: 0,
    marginBottom: 0,
    color: tokens.colorNeutralForeground1,
  },
  subtitle: {
    display: 'block',
    marginTop: 0,
    marginBottom: 0,
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    '@media (max-width: 900px)': {
      justifyContent: 'flex-start',
    },
  },
});

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.copy}>
        <Title2 as="h1" className={styles.title}>
          {title}
        </Title2>
        {subtitle && (
          <Text as="p" className={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
