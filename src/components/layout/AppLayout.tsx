import { makeStyles, tokens } from '@fluentui/react-components';
import useAppStore from '@src/store/useAppStore';
import AppSidebar from '@src/components/layout/AppSidebar';
import DashboardPage from '@src/pages/DashboardPage';
import StreamsPage from '@src/pages/StreamsPage';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  main: {
    minWidth: 0,
    flex: 1,
    overflow: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  pageFrame: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '1440px',
    marginRight: 'auto',
    marginLeft: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    '@media (max-width: 720px)': {
      padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalS}`,
    },
  },
});

function PageContent() {
  const activeTab = useAppStore((s) => s.activeTab);
  if (activeTab === 'streams') return <StreamsPage />;
  return <DashboardPage />;
}

export default function AppLayout() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <AppSidebar />
      <main className={styles.main}>
        <div className={styles.pageFrame}>
          <PageContent />
        </div>
      </main>
    </div>
  );
}
