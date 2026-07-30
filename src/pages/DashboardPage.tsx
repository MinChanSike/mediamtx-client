import { useState } from 'react';
import {
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  MessageBar,
  MessageBarBody,
  OverlayDrawer,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Code20Regular, Dismiss24Regular } from '@fluentui/react-icons';
import useCloseButtonStyles from '@src/components/common/useCloseButtonStyles';
import PageHeader from '@src/components/common/PageHeader';
import ConfigRawView from '@src/components/config/ConfigRawView';
import ConfigSummaryView from '@src/components/config/ConfigSummaryView';
import ServerStatusCard from '@src/components/dashboard/ServerStatusCard';
import DashboardMetricsGrid from '@src/components/dashboard/DashboardMetricsGrid';
import { useMediaMTXConfig, useMediaMTXRawConfig } from '@src/hooks/useMediaMTXConfig';
import type { CompleteServerConfig, GlobalConfig } from '@src/types/config';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)',
    gap: tokens.spacingHorizontalS,
    alignItems: 'start',
    '@media (max-width: 1080px)': {
      gridTemplateColumns: '1fr',
    },
  },
  configSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  configHeader: {
    display: 'flex',
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    '@media (max-width: 620px)': {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
  },
  configCopy: {
    display: 'flex',
    minWidth: 0,
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  configSubtitle: {
    color: tokens.colorNeutralForeground3,
  },
  drawerBody: {
    display: 'flex',
    minHeight: 0,
    height: '100%',
    flexDirection: 'column',
  },
  drawerContent: {
    display: 'flex',
    minHeight: 0,
    flex: 1,
  },
});

interface DashboardConfigContentProps {
  config: GlobalConfig;
}

export function DashboardConfigContent({ config }: DashboardConfigContentProps) {
  return <ConfigSummaryView config={config} />;
}

interface RawConfigDrawerProps {
  config: CompleteServerConfig | undefined;
  isError: boolean;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function RawConfigDrawerContent({ config }: { config: CompleteServerConfig }) {
  const styles = useStyles();

  return (
    <div className={styles.drawerContent}>
      <ConfigRawView config={config} />
    </div>
  );
}

export function RawConfigDrawer({
  config,
  isError,
  isLoading,
  isOpen,
  onClose,
}: RawConfigDrawerProps) {
  const styles = useStyles();
  const closeButtonStyles = useCloseButtonStyles();

  return (
    <OverlayDrawer
      open={isOpen}
      position="end"
      size="medium"
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close raw JSON"
              className={closeButtonStyles.dangerHover}
              icon={<Dismiss24Regular />}
              onClick={onClose}
            />
          }
        >
          Raw Configuration JSON
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody className={styles.drawerBody}>
        {isLoading && <Spinner label="Loading raw configuration..." />}
        {isError && (
          <MessageBar intent="error">
            <MessageBarBody>Unable to load raw configuration.</MessageBarBody>
          </MessageBar>
        )}
        {config && <RawConfigDrawerContent config={config} />}
      </DrawerBody>
    </OverlayDrawer>
  );
}

export default function DashboardPage() {
  const styles = useStyles();
  const [isRawConfigOpen, setIsRawConfigOpen] = useState(false);
  const { data: config, isLoading: isConfigLoading, isError: isConfigError } = useMediaMTXConfig();
  const {
    data: rawConfig,
    isLoading: isRawConfigLoading,
    isError: isRawConfigError,
  } = useMediaMTXRawConfig(isRawConfigOpen);

  return (
    <div className={styles.root}>
      <PageHeader
        title="Server Dashboard"
        subtitle="MediaMTX Active Stream status, metrics, and configuration"
      />
      <div className={styles.contentGrid}>
        <ServerStatusCard />
        <DashboardMetricsGrid />
      </div>
      <section className={styles.configSection} aria-label="Configuration">
        <div className={styles.configHeader}>
          <div className={styles.configCopy}>
            <Text as="h2" size={500} weight="semibold">
              Configuration
            </Text>
            <Text as="p" size={200} className={styles.configSubtitle}>
              Read-only MediaMTX server configuration
            </Text>
          </div>
          <Button
            appearance="secondary"
            icon={<Code20Regular />}
            onClick={() => setIsRawConfigOpen(true)}
            size="small"
          >
            Show Raw JSON
          </Button>
        </div>

        {isConfigLoading && <Spinner label="Loading configuration..." />}

        {isConfigError && (
          <MessageBar intent="error">
            <MessageBarBody>
              Unable to load configuration. Check that MediaMTX API is reachable.
            </MessageBarBody>
          </MessageBar>
        )}

        {config && <DashboardConfigContent config={config} />}
      </section>
      <RawConfigDrawer
        config={rawConfig}
        isError={isRawConfigError}
        isLoading={isRawConfigLoading}
        isOpen={isRawConfigOpen}
        onClose={() => setIsRawConfigOpen(false)}
      />
    </div>
  );
}
