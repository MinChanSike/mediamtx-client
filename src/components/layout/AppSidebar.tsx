import React, { useEffect, useState } from 'react';
import {
  Button,
  Field,
  Input,
  Nav,
  NavItem,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import type { OnNavItemSelectData } from '@fluentui/react-components';
import {
  ChevronLeft20Regular,
  CircleFilled,
  History24Regular,
  Home24Regular,
  SlideGrid20Filled,
  Settings24Regular,
  Video24Regular,
} from '@fluentui/react-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from '@src/components/common/ThemeToggle';
import { useStoreBackedServerInfo } from '@src/hooks/useMediaMTXApi';
import { usePlaybackSyncEndpoint } from '@src/hooks/usePlaybackSyncEndpoint';
import { DASHBOARD_ROUTE, PLAYBACK_SYNC_ROUTE, STREAMS_ROUTE } from '@src/router/routes';
import useAppStore from '@src/store/useAppStore';
import usePlaybackSyncStore from '@src/store/usePlaybackSyncStore';
import { getApiAvailabilityStatus } from '@src/utils/apiAvailabilityStatus';

type NavTab = 'dashboard' | 'streams' | 'playback-sync';

type SidebarNavItem = {
  id: NavTab;
  label: string;
  path: string;
  icon: React.ReactElement;
};

const NAV_ITEMS: SidebarNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: DASHBOARD_ROUTE,
    icon: <Home24Regular />,
  },
  {
    id: 'streams',
    label: 'Streams',
    path: STREAMS_ROUTE,
    icon: <Video24Regular />,
  },
  {
    id: 'playback-sync',
    label: 'Playback Sync',
    path: PLAYBACK_SYNC_ROUTE,
    icon: <History24Regular />,
  },
];

const useStyles = makeStyles({
  root: {
    position: 'relative',
    display: 'flex',
    height: '100%',
    flexShrink: 0,
    flexDirection: 'column',
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
    transitionDuration: tokens.durationNormal,
    transitionProperty: 'width',
    transitionTimingFunction: tokens.curveEasyEase,
  },
  expanded: {
    width: '224px',
  },
  collapsed: {
    width: '52px',
  },
  header: {
    display: 'flex',
    height: '56px',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    paddingRight: tokens.spacingHorizontalS,
    paddingLeft: tokens.spacingHorizontalM,
  },
  collapsedHeader: {
    justifyContent: 'center',
    paddingRight: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalXS,
  },
  brand: {
    display: 'flex',
    minWidth: 0,
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  brandMark: {
    display: 'grid',
    width: '24px',
    height: '24px',
    flexShrink: 0,
    placeItems: 'center',
    border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  collapsedBrandButton: {
    minWidth: '32px',
    width: '32px',
    height: '32px',
    border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  titleGroup: {
    display: 'flex',
    minWidth: 0,
    flexDirection: 'column',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    flexShrink: 0,
    marginLeft: 'auto',
    alignSelf: 'flex-start',
    color: tokens.colorNeutralForeground4,
  },
  statusDotOnline: {
    color: tokens.colorPaletteLightGreenForeground3,
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    paddingTop: tokens.spacingVerticalS,
    paddingRight: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalXS,
  },
  collapsedNav: {
    paddingRight: tokens.spacingHorizontalXXS,
    paddingLeft: tokens.spacingHorizontalXXS,
  },
  navItem: {
    minHeight: '40px',
    alignItems: 'center',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    '::after': {
      marginLeft: '-10px',
    },
  },
  collapsedNavItem: {
    justifyContent: 'center',
    paddingRight: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalXS,
    '::after': {
      marginLeft: '-42px',
    },
  },
  editPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingVerticalM,
  },
  editActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXS,
  },
  footer: {
    display: 'flex',
    minHeight: '52px',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    paddingRight: tokens.spacingHorizontalM,
    paddingLeft: tokens.spacingHorizontalM,
  },
  collapsedFooter: {
    justifyContent: 'center',
    padding: tokens.spacingHorizontalXS,
  },
});

export function pathToTab(pathname: string): NavTab {
  if (pathname === STREAMS_ROUTE || pathname.startsWith(`${STREAMS_ROUTE}/`)) return 'streams';
  if (pathname === PLAYBACK_SYNC_ROUTE || pathname.startsWith(`${PLAYBACK_SYNC_ROUTE}/`)) return 'playback-sync';
  return 'dashboard';
}

export function expandCollapsedSidebar(toggleSidebar: () => void) {
  toggleSidebar();
}

export function navigateToSidebarItem(
  item: Pick<SidebarNavItem, 'id' | 'path'>,
  setActiveTab: (tab: NavTab) => void,
  navigate: (path: string) => void
) {
  setActiveTab(item.id);
  navigate(item.path);
}

export default function AppSidebar() {
  const styles = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const isSidebarCollapsed = useAppStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const serverUrl = useAppStore((s) => s.serverUrl);
  const setServerUrl = useAppStore((s) => s.setServerUrl);
  const setPlaybackEndpointOverride = usePlaybackSyncStore((s) => s.setEndpointOverride);
  const playbackEndpoint = usePlaybackSyncEndpoint();

  const [isEditing, setIsEditing] = useState(false);
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [playbackUrlInput, setPlaybackUrlInput] = useState(
    playbackEndpoint.baseUrl ?? playbackEndpoint.derivedBaseUrl ?? ''
  );

  useEffect(() => {
    setUrlInput(serverUrl);
  }, [serverUrl]);

  useEffect(() => {
    if (!isEditing) {
      setPlaybackUrlInput(playbackEndpoint.baseUrl ?? playbackEndpoint.derivedBaseUrl ?? '');
    }
  }, [isEditing, playbackEndpoint.baseUrl, playbackEndpoint.derivedBaseUrl]);

  useEffect(() => {
    setActiveTab(pathToTab(location.pathname));
  }, [location.pathname, setActiveTab]);

  const { isError, isPending } = useStoreBackedServerInfo();

  const connectionStatus = getApiAvailabilityStatus({ isError, isPending });

  const handleNavSelect = (_event: unknown, data: OnNavItemSelectData) => {
    const item = NAV_ITEMS.find((candidate) => candidate.id === data.value);
    if (item) navigateToSidebarItem(item, setActiveTab, navigate);
  };

  const handleSave = () => {
    const nextServerUrl = urlInput.trim();
    if (!nextServerUrl) return;

    const nextPlaybackUrl = playbackUrlInput.trim();
    if (nextPlaybackUrl === playbackEndpoint.derivedBaseUrl || !nextPlaybackUrl) {
      setPlaybackEndpointOverride(nextServerUrl, null);
    } else {
      setPlaybackEndpointOverride(nextServerUrl, nextPlaybackUrl);
    }
    setServerUrl(nextServerUrl);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setUrlInput(serverUrl);
    setPlaybackUrlInput(playbackEndpoint.baseUrl ?? playbackEndpoint.derivedBaseUrl ?? '');
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSave();
    else if (event.key === 'Escape') handleCancel();
  };

  return (
    <aside
      className={mergeClasses(styles.root, isSidebarCollapsed ? styles.collapsed : styles.expanded)}
    >
      <div className={mergeClasses(styles.header, isSidebarCollapsed && styles.collapsedHeader)}>
        {!isSidebarCollapsed && (
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              <SlideGrid20Filled />
            </span>
            <div className={styles.titleGroup}>
              <Text weight="semibold" size={300} truncate>
                MediaMTX
              </Text>
              <Text className={styles.subtitle} size={100} truncate>
                Client Console
              </Text>
            </div>
            <CircleFilled
              aria-label="MediaMTX API status indicator"
              className={mergeClasses(
                styles.statusDot,
                connectionStatus === 'online' && styles.statusDotOnline
              )}
            />
          </div>
        )}
        {isSidebarCollapsed ? (
          <Button
            aria-label="Expand sidebar"
            appearance="subtle"
            className={styles.collapsedBrandButton}
            icon={<SlideGrid20Filled />}
            onClick={() => expandCollapsedSidebar(toggleSidebar)}
            size="small"
          />
        ) : (
          <Tooltip content="Collapse sidebar" relationship="label">
            <Button
              aria-label="Collapse sidebar"
              appearance="subtle"
              icon={<ChevronLeft20Regular />}
              onClick={toggleSidebar}
              size="small"
            />
          </Tooltip>
        )}
      </div>

      <Nav
        aria-label="Primary navigation"
        className={mergeClasses(styles.nav, isSidebarCollapsed && styles.collapsedNav)}
        density="small"
        onNavItemSelect={handleNavSelect}
        selectedValue={activeTab}
      >
        {NAV_ITEMS.map((item) => (
          <Tooltip
            content={item.label}
            key={item.id}
            relationship="label"
            visible={isSidebarCollapsed ? undefined : false}
          >
            <NavItem
              icon={item.icon}
              title={isSidebarCollapsed ? item.label : undefined}
              value={item.id}
              className={mergeClasses(
                styles.navItem,
                isSidebarCollapsed && styles.collapsedNavItem
              )}
            >
              {isSidebarCollapsed ? null : item.label}
            </NavItem>
          </Tooltip>
        ))}
      </Nav>

      {!isSidebarCollapsed && isEditing && (
        <div className={styles.editPanel}>
          <Field label="Server API endpoint" size="small">
            <Input
              id="server-url-input"
              type="text"
              value={urlInput}
              onChange={(_event, data) => setUrlInput(data.value)}
              onKeyDown={handleKeyDown}
              placeholder="http://localhost:9997"
              size="small"
              autoFocus
            />
          </Field>
          <Field label="Playback server endpoint" size="small">
            <Input
              id="playback-server-url-input"
              type="text"
              value={playbackUrlInput}
              onChange={(_event, data) => setPlaybackUrlInput(data.value)}
              onKeyDown={handleKeyDown}
              placeholder="http://localhost:9996"
              size="small"
            />
          </Field>
          <div className={styles.editActions}>
            <Button
              id="server-url-cancel"
              appearance="secondary"
              onClick={handleCancel}
              size="small"
            >
              Cancel
            </Button>
            <Button id="server-url-save" appearance="primary" onClick={handleSave} size="small">
              Save
            </Button>
          </div>
        </div>
      )}

      {!isSidebarCollapsed && (
        <div className={styles.footer}>
          <Tooltip content="Edit server endpoints" relationship="label">
            <Button
              id="server-url-edit-btn"
              aria-expanded={isEditing}
              aria-label="Edit server endpoints"
              appearance={isEditing ? 'secondary' : 'subtle'}
              icon={<Settings24Regular />}
              onClick={() => setIsEditing((current) => !current)}
              size="small"
            />
          </Tooltip>
          <ThemeToggle />
        </div>
      )}

      {isSidebarCollapsed && (
        <div className={mergeClasses(styles.footer, styles.collapsedFooter)}>
          <ThemeToggle />
        </div>
      )}
    </aside>
  );
}
