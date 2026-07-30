import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SSRProvider } from '@fluentui/react-components';
import { composeCompleteServerConfig } from '@src/api/configApi';
import {
  copyRawConfigToClipboard,
  getRawConfigPreStyle,
} from '@src/components/config/ConfigRawView';
import AppSidebar from '@src/components/layout/AppSidebar';
import { DashboardConfigContent, RawConfigDrawerContent } from '@src/pages/DashboardPage';
import useAppStore from '@src/store/useAppStore';
import type { CompleteServerConfig, GlobalConfig } from '@src/types/config';

function renderWithProviders(element: React.ReactElement) {
  return renderToStaticMarkup(
    createElement(SSRProvider, null, createElement(MemoryRouter, null, element))
  );
}

const sampleConfig: GlobalConfig = {
  logLevel: 'info',
  logDestinations: ['stdout'],
  logFile: 'mediamtx.log',
  readTimeout: '10s',
  writeTimeout: '10s',
  readBufferCount: 512,
  udpMaxPayloadSize: 1472,
  api: true,
  apiAddress: '127.0.0.1:9997',
  metrics: true,
  metricsAddress: '127.0.0.1:9998',
  pprof: false,
  pprofAddress: undefined,
  playback: true,
  playbackAddress: ':9996',
  rtsp: true,
  hlsAddress: ':8888',
  rtspAddress: ':8554',
  rtmp: true,
  rtmpAddress: ':1935',
  hls: true,
  webrtc: true,
  webrtcAddress: ':8889',
  srt: true,
  srtAddress: ':8890',
  paths: {
    all: {
      source: 'publisher',
      sourceProtocol: 'automatic',
      sourceAnyPublisher: true,
      record: false,
      playback: true,
      maxReaders: 0,
    },
  },
};

const sampleRawConfig: CompleteServerConfig = {
  ...sampleConfig,
  authInternalUsers: [{ user: 'admin', pass: 'secret' }],
  rtspTransports: ['udp', 'tcp'],
  pathDefaults: {
    source: 'publisher',
    record: false,
  },
  paths: {
    all: {
      source: 'publisher',
      sourceProtocol: 'automatic',
      sourceAnyPublisher: true,
      record: false,
      playback: true,
      maxReaders: 0,
    },
  },
};

afterEach(() => {
  useAppStore.setState({ activeTab: 'dashboard', isSidebarCollapsed: false });
});

describe('raw config toggle placement and state', () => {
  test('removes the raw config control and state from the sidebar', async () => {
    const dashboardSource = await Bun.file('src/pages/DashboardPage.tsx').text();
    const sidebarSource = await Bun.file('src/components/layout/AppSidebar.tsx').text();
    const storeSource = await Bun.file('src/store/useAppStore.ts').text();

    expect(dashboardSource).not.toContain('Show Summary');
    expect(dashboardSource).toContain('Show Raw JSON');
    expect(sidebarSource).not.toContain('SidebarRawConfigToggle');
    expect(sidebarSource).not.toContain('Show Raw JSON');
    expect(sidebarSource).not.toContain('Show Summary');
    expect(sidebarSource).not.toContain('toggleRawConfig');
    expect(sidebarSource).not.toContain('showRawConfig');
    expect(storeSource).not.toContain('toggleRawConfig');
    expect(storeSource).not.toContain('showRawConfig');
  });

  test('does not render raw or summary labels in the expanded dashboard sidebar', () => {
    useAppStore.setState({ activeTab: 'dashboard', isSidebarCollapsed: false });

    const sidebarMarkup = renderWithProviders(createElement(AppSidebar));

    expect(sidebarMarkup).not.toContain('Show Raw JSON');
    expect(sidebarMarkup).not.toContain('Show Summary');
  });

  test('renders the server status as a brand dot instead of sidebar status text', async () => {
    const sidebarSource = await Bun.file('src/components/layout/AppSidebar.tsx').text();
    const sidebarMarkup = renderWithProviders(createElement(AppSidebar));

    expect(sidebarSource).not.toContain("StatusBadge from '@src/components/common/StatusBadge'");
    expect(sidebarSource).not.toContain('<StatusBadge');
    expect(sidebarSource).toContain('CircleFilled');
    expect(sidebarSource).toContain('statusDotOnline');
    expect(sidebarSource).toContain("connectionStatus === 'online'");
    expect(sidebarMarkup).toContain('MediaMTX API status indicator');
    expect(sidebarMarkup).not.toContain('Online');
    expect(sidebarMarkup).not.toContain('Offline');
    expect(sidebarMarkup).not.toContain('Connecting');
    expect(sidebarMarkup).not.toContain('Unknown');
  });

  test('renders a collapsed brand logo action that expands the sidebar', async () => {
    const sidebarSource = await Bun.file('src/components/layout/AppSidebar.tsx').text();

    expect(sidebarSource).toContain('{isSidebarCollapsed ? (');
    expect(sidebarSource).toContain('collapsedBrandButton');
    expect(sidebarSource).toContain('icon={<SlideGrid20Filled />}');
    expect(sidebarSource).toContain('aria-label="Expand sidebar"');
    expect(sidebarSource).toContain('onClick={() => expandCollapsedSidebar(toggleSidebar)}');
  });

  test('keeps collapsed sidebar navigation labels on the React Router navigation path', async () => {
    const sidebarSource = await Bun.file('src/components/layout/AppSidebar.tsx').text();

    expect(sidebarSource).toContain('const handleNavSelect');
    expect(sidebarSource).toContain('navigateToSidebarItem(item, setActiveTab, navigate)');
    expect(sidebarSource).toContain('useNavigate');
    expect(sidebarSource).not.toContain('history.pushState');
    expect(sidebarSource).toContain('onNavItemSelect={handleNavSelect}');
    expect(sidebarSource).toContain('value={item.id}');
    expect(sidebarSource).toContain('content={item.label}');
    expect(sidebarSource).toContain('title={isSidebarCollapsed ? item.label : undefined}');
    expect(sidebarSource).toContain('{isSidebarCollapsed ? null : item.label}');
  });

  test('owns the raw config drawer state and control in DashboardPage', async () => {
    const dashboardSource = await Bun.file('src/pages/DashboardPage.tsx').text();

    expect(dashboardSource).toContain('const [isRawConfigOpen, setIsRawConfigOpen] = useState(false)');
    expect(dashboardSource).toContain('onClick={() => setIsRawConfigOpen(true)}');
    expect(dashboardSource).toContain('useMediaMTXRawConfig(isRawConfigOpen)');
    expect(dashboardSource).toContain('<RawConfigDrawer');
    expect(dashboardSource).toContain('isOpen={isRawConfigOpen}');
    expect(dashboardSource).toContain('position="end"');
    expect(dashboardSource).toContain('size="medium"');
    expect(dashboardSource).toContain('<ConfigRawView config={config} />');
    expect(dashboardSource).toContain('config={rawConfig}');
    expect(dashboardSource).not.toContain('useAppStore');
    expect(dashboardSource).not.toContain('showRawConfig=');
  });

  test('keeps DashboardPage configuration content as the summary view', () => {
    const summaryMarkup = renderToStaticMarkup(
      createElement(DashboardConfigContent, { config: sampleConfig })
    );

    expect(summaryMarkup).toContain('Network Runtime');
    expect(summaryMarkup).not.toContain('Raw JSON');
    expect(summaryMarkup).not.toContain(JSON.stringify(sampleConfig, null, 2));
  });

  test('renders complete raw JSON with copy action inside the right-side drawer component', async () => {
    const drawerMarkup = renderToStaticMarkup(
      createElement(RawConfigDrawerContent, { config: sampleRawConfig })
    );

    expect(drawerMarkup).toContain('Copy');
    expect(drawerMarkup).toContain('logLevel');
    expect(drawerMarkup).toContain('pathDefaults');
    expect(drawerMarkup).toContain('paths');
    expect(drawerMarkup).not.toContain('global');

    const dashboardSource = await Bun.file('src/pages/DashboardPage.tsx').text();
    expect(dashboardSource).toContain('Raw Configuration JSON');
    expect(dashboardSource).toContain('<OverlayDrawer');
    expect(dashboardSource).toContain('position="end"');
  });

  test('keeps drawer size while raw JSON fills and scrolls inside the drawer body', async () => {
    const dashboardSource = await Bun.file('src/pages/DashboardPage.tsx').text();
    const rawViewSource = await Bun.file('src/components/config/ConfigRawView.tsx').text();

    expect(dashboardSource).toContain('size="medium"');
    expect(dashboardSource).toContain("height: '100%'");
    expect(dashboardSource).toContain('drawerContent');
    expect(rawViewSource).toContain('flex: 1');
    expect(rawViewSource).toContain("overflow: 'auto'");
    expect(rawViewSource).not.toContain("maxHeight: '520px'");
  });

  test('keeps syntax highlighting but lets Fluent tokens own raw JSON background and foreground', async () => {
    const rawViewSource = await Bun.file('src/components/config/ConfigRawView.tsx').text();

    expect(getRawConfigPreStyle({
      background: '#ffffff',
      backgroundColor: '#ffffff',
      color: '#000000',
      tabSize: 2,
    })).toEqual({ tabSize: 2 });
    expect(rawViewSource).toContain('backgroundColor: tokens.colorNeutralBackground2');
    expect(rawViewSource).toContain('color: tokens.colorNeutralForeground1');
    expect(rawViewSource).toContain('getRawConfigPreStyle(style)');
    expect(rawViewSource).not.toContain('style={style}');
    expect(rawViewSource).toContain('<Highlight');
  });

  test('copies raw config JSON through ConfigRawView copy helper', async () => {
    const writes: string[] = [];
    const clipboard = {
      writeText: (value: string) => {
        writes.push(value);
        return Promise.resolve();
      },
    };

    await copyRawConfigToClipboard(sampleRawConfig, clipboard);

    expect(writes).toEqual([JSON.stringify(sampleRawConfig, null, 2)]);

    const rawViewSource = await Bun.file('src/components/config/ConfigRawView.tsx').text();
    const packageJson = await Bun.file('package.json').json();

    expect(rawViewSource).toContain('onClick={() => copyRawConfigToClipboard(config)}');
    expect(rawViewSource).toContain('prism-react-renderer');
    expect(rawViewSource).toContain('<Highlight');
    expect(packageJson.dependencies['prism-react-renderer']).toBeDefined();
    expect(writes[0]).toContain('authInternalUsers');
    expect(writes[0]).toContain('rtspTransports');
  });

  test('composes raw server configuration from unparsed global and path defaults', () => {
    const rawGlobalConfig = {
      ...sampleConfig,
      authInternalUsers: [{ user: 'admin', pass: 'secret' }],
      rtspTransports: ['udp', 'tcp'],
      paths: {
        staleGlobalPath: {
          source: 'publisher',
        },
      },
    };

    const completeConfig = composeCompleteServerConfig(
      rawGlobalConfig,
      { source: 'publisher', record: false }
    );

    expect(completeConfig.logLevel).toBe(sampleConfig.logLevel);
    expect(completeConfig.apiAddress).toBe(sampleConfig.apiAddress);
    expect(completeConfig.authInternalUsers).toEqual([{ user: 'admin', pass: 'secret' }]);
    expect(completeConfig.rtspTransports).toEqual(['udp', 'tcp']);
    expect('global' in completeConfig).toBe(false);
    expect(completeConfig.pathDefaults).toEqual({ source: 'publisher', record: false });
    expect(completeConfig.paths).toEqual({
      staleGlobalPath: {
        source: 'publisher',
      },
    });
  });

  test('fetches global config and path defaults for complete raw JSON without path config list', async () => {
    const apiSource = await Bun.file('src/api/configApi.ts').text();

    expect(apiSource).toContain('/v3/config/global/get');
    expect(apiSource).toContain('getRawGlobalConfig');
    expect(apiSource).toContain('getRawGlobalConfig()');
    expect(apiSource).toContain('/v3/config/pathdefaults/get');
    expect(apiSource).not.toContain('/v3/config/paths/list');
    expect(apiSource).not.toContain('firstPage.pageCount');
    expect(apiSource).not.toContain('remainingPages');
  });
});
