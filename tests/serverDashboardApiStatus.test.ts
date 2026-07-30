import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ProtocolRow,
  getApiAvailabilityStatus,
  getServerListenerRows,
} from '../src/components/dashboard/ServerStatusCard';
import AppSidebar from '../src/components/layout/AppSidebar';
import { getServerInfo } from '../src/api/serverInfoApi';
import { refreshServerInfoNow } from '../src/hooks/useMediaMTXApi';
import { calculateDashboardMetrics } from '../src/store/useDashboardMetricsStore';
import useAppStore from '../src/store/useAppStore';
import useMediaMTXApiStore from '../src/store/useMediaMTXApiStore';
import type { GlobalConfig } from '../src/types/config';

const baseConfig: GlobalConfig = {
  logLevel: 'info',
  logDestinations: ['stdout'],
  logFile: 'mediamtx.log',
  readTimeout: '10s',
  writeTimeout: '10s',
  readBufferCount: 512,
  udpMaxPayloadSize: 1472,
  apiAddress: '127.0.0.1:9997',
  metricsAddress: '127.0.0.1:9998',
  hlsAddress: ':8888',
  rtspAddress: ':8554',
  rtmpAddress: ':1935',
  webrtcAddress: ':8889',
  paths: {},
};

const obsoleteAudienceTerm = (text: string) => text.replace('Audience', ['View', 'er'].join(''));

describe('Server dashboard listener model', () => {
  test('reports dashboard API status as offline when a current error exists with stale data', () => {
    const staleConfig = baseConfig;

    expect(staleConfig.apiAddress).toBe('127.0.0.1:9997');
    expect(getApiAvailabilityStatus({ data: staleConfig, isError: true, isPending: false })).toBe(
      'offline'
    );
    expect(getApiAvailabilityStatus({ data: staleConfig, isError: true, isPending: true })).toBe(
      'offline'
    );
  });

  test('reports dashboard API status as connecting only while pending and online on success', () => {
    expect(getApiAvailabilityStatus({ isError: false, isPending: true })).toBe('connecting');
    expect(getApiAvailabilityStatus({ data: baseConfig, isError: false, isPending: false })).toBe(
      'online'
    );
  });

  test('uses the shared error-first status helper for all API status surfaces', async () => {
    const helperSource = await Bun.file('src/utils/apiAvailabilityStatus.ts').text();
    const statusSurfaces = [
      'src/components/dashboard/ServerStatusCard.tsx',
      'src/components/layout/AppHeader.tsx',
      'src/components/layout/AppSidebar.tsx',
    ];

    expect(helperSource.indexOf('if (state.isError)')).toBeLessThan(
      helperSource.indexOf('if (state.isPending)')
    );

    for (const file of statusSurfaces) {
      const source = await Bun.file(file).text();

      expect(source).toContain('getApiAvailabilityStatus');
      expect(source).not.toContain("isPending ? 'connecting' : isError ? 'offline' : 'online'");
    }
  });

  test('renders all MediaMTX protocol and service listener labels with configured addresses', () => {
    const rows = getServerListenerRows({
      ...baseConfig,
      rtspAddress: ':8554',
      rtspsAddress: ':8322',
      rtmpAddress: ':1935',
      rtmpsAddress: ':1936',
      hlsAddress: ':8888',
      webrtcAddress: ':8889',
      srtAddress: ':8890',
      apiAddress: '127.0.0.1:9997',
      metricsAddress: '127.0.0.1:9998',
      pprofAddress: '127.0.0.1:9999',
      playbackAddress: ':9996',
    });

    expect(rows.map((row) => row.label)).toEqual([
      'RTSP',
      'RTSPS',
      'RTMP',
      'RTMPS',
      'HLS',
      'WebRTC',
      'SRT',
      'API',
      'Metrics',
      'PPROF',
      'Playback',
    ]);
    expect(rows.map((row) => row.address)).toEqual([
      ':8554',
      ':8322',
      ':1935',
      ':1936',
      ':8888',
      ':8889',
      ':8890',
      '127.0.0.1:9997',
      '127.0.0.1:9998',
      '127.0.0.1:9999',
      ':9996',
    ]);
  });

  test('maps explicit enablement booleans to enabled or disabled and missing booleans to unknown', () => {
    const rows = getServerListenerRows({
      ...baseConfig,
      rtsp: true,
      rtmp: false,
      hls: false,
      webrtc: false,
      srt: false,
      api: true,
      metrics: false,
      pprof: false,
      playback: false,
      rtspsAddress: ':8322',
      rtmpsAddress: ':1936',
      srtAddress: ':8890',
      pprofAddress: '127.0.0.1:9999',
      playbackAddress: ':9996',
    });

    expect(Object.fromEntries(rows.map((row) => [row.label, row.status]))).toEqual({
      RTSP: 'enabled',
      RTSPS: 'enabled',
      RTMP: 'disabled',
      RTMPS: 'disabled',
      HLS: 'disabled',
      WebRTC: 'disabled',
      SRT: 'disabled',
      API: 'enabled',
      Metrics: 'disabled',
      PPROF: 'disabled',
      Playback: 'disabled',
    });

    expect(getServerListenerRows(baseConfig).find((row) => row.label === 'HLS')?.status).toBe(
      'unknown'
    );
  });

  test('renders protocol row in protocol, address, and status cells', () => {
    const markup = renderToStaticMarkup(
      createElement(ProtocolRow, {
        row: { label: 'RTSP', address: ':8554', status: 'enabled' },
      })
    );

    expect(markup).toContain('role="row"');
    expect(markup.match(/role="cell"/g)?.length).toBe(3);
    expect(markup.indexOf('RTSP')).toBeLessThan(markup.indexOf(':8554'));
    expect(markup.indexOf(':8554')).toBeLessThan(markup.indexOf('Enabled'));
  });

  test('uses grid columns and table roles for aligned listener rows', async () => {
    const source = await Bun.file('src/components/dashboard/ServerStatusCard.tsx').text();

    expect(source).toContain("display: 'grid'");
    expect(source).toContain('gridTemplateColumns');
    expect(source).toContain('role="table"');
    expect(source).toContain('role="columnheader"');
    expect(source).toContain('Protocol');
    expect(source).toContain('Address');
    expect(source).toContain('Status');
  });
});

describe('Server dashboard metrics model', () => {
  test('removes stream counters and their path-derived implementation from the sidebar', async () => {
    useAppStore.setState({ isSidebarCollapsed: false });
    const markup = renderToStaticMarkup(createElement(AppSidebar));
    const source = await Bun.file('src/components/layout/AppSidebar.tsx').text();

    expect(markup).not.toContain('Stream counters');
    expect(markup).not.toContain('Total Streams');
    expect(markup).not.toContain('Active Streams');
    expect(markup).not.toContain('Active Readers');
    expect(source).not.toContain('useMediaMTXPaths');
    expect(source).not.toContain('isStreamOnline');
    expect(source).not.toContain('streamStats');
  });

  test('derives default zero dashboard metrics when path, config, and info data are absent', () => {
    const metrics = calculateDashboardMetrics({});

    expect(metrics).toMatchObject({
      uptime: 0,
      activePaths: 0,
      bytesReceived: 0,
      bytesSent: 0,
      rtspViewers: 0,
      rtspsViewers: 0,
      rtmpViewers: 0,
      rtmpsConnections: 0,
      webRTCViewers: 0,
      hlsViewers: 0,
      srtConnections: 0,
      totalViewers: 0,
    });
    expect(Object.fromEntries(metrics.cards.map((card) => [card.label, card.value]))).toMatchObject(
      {
        Uptime: '-',
        'Active Streams': 0,
        'Bytes Received': '0 B',
        'Bytes Sent': '0 B',
        'Total Readers': 0,
      }
    );
  });

  test('derives traffic, uptime, and displayed reader metrics without counting RTSP connections', () => {
    const metrics = calculateDashboardMetrics({
      globalConfig: baseConfig,
      serverInfo: {
        version: 'v1.12.3',
        started: '2026-07-29T00:00:00Z',
        uptime: 120,
      },
      paths: {
        itemCount: 4,
        pageCount: 1,
        items: [
          {
            name: 'alpha',
            source: 'publisher',
            sourceError: '',
            tracks: [],
            bytesReceived: 1024,
            bytesSent: 4096,
            readers: [
              { id: 'rtsp-conn', type: 'rtspConn', state: 'read' },
              { id: 'rtsp-session', type: 'rtspSession', state: 'read' },
              { id: 'rtsps-conn', type: 'rtspsConn', state: 'read' },
              { id: 'rtsps-session', type: 'rtspsSession', state: 'read' },
              { id: 'rtmp', type: 'rtmpConn', state: 'read' },
              { id: 'hls', type: 'hlsSession', state: 'read' },
            ],
          },
          {
            name: 'bravo',
            source: 'publisher',
            sourceError: '',
            tracks: [],
            bytesReceived: 2048,
            bytesSent: 8192,
            readers: [
              { id: 'rtmps', protocol: 'rtmps', type: '', state: 'read' },
              { id: 'webrtc', protocol: 'webrtc', type: '', state: 'read' },
              { id: 'srt', protocol: 'srt', type: '', state: 'read' },
            ],
          },
        ],
      },
    });

    expect(metrics).toMatchObject({
      uptime: 120,
      activePaths: 4,
      bytesReceived: 3072,
      bytesSent: 12288,
      rtspViewers: 1,
      rtspsViewers: 1,
      rtmpViewers: 1,
      rtmpsConnections: 1,
      webRTCViewers: 1,
      hlsViewers: 1,
      srtConnections: 1,
      totalViewers: 7,
    });

    const cardsByLabel = Object.fromEntries(
      metrics.cards.map((card) => [
        card.label,
        { value: card.value, description: card.description },
      ])
    );
    expect(cardsByLabel).toMatchObject({
      Uptime: { value: '2 minutes', description: 'MediaMTX v1.12.3' },
      'Active Streams': { value: 4 },
      'Bytes Received': { value: '3 KB' },
      'Bytes Sent': { value: '12 KB' },
      'RTSP Readers': { value: 1 },
      'RTSPS Readers': { value: 1 },
      'RTMP Readers': { value: 1 },
      'RTMPS READERS': { value: 1, description: 'Active RTMPS readers' },
      'WebRTC Readers': { value: 1 },
      'SRT READERS': { value: 1, description: 'Active SRT readers' },
      'HLS Readers': { value: 1 },
      'Total Readers': { value: 7 },
    });

    const cardLabels = metrics.cards.map((card) => card.label);
    expect(cardLabels).toContain('RTMPS READERS');
    expect(cardLabels).toContain('SRT READERS');
    expect(cardLabels).not.toContain(obsoleteAudienceTerm('RTMPS Audiences').toUpperCase());
    expect(cardLabels).not.toContain(obsoleteAudienceTerm('SRT Audiences').toUpperCase());
    expect(cardLabels).not.toContain(obsoleteAudienceTerm('Total Audiences'));
    expect(cardLabels).not.toContain('RTMPS Connections');
    expect(cardLabels).not.toContain('SRT Connections');
    for (const obsoleteLabel of [
      'RTSP Connections',
      'RTSP Sessions',
      'RTMP Connections',
      'WebRTC Sessions',
      'HLS Muxers',
      'Total Sessions',
    ]) {
      expect(cardLabels).not.toContain(obsoleteLabel);
    }
  });

  test('keeps supported legacy reader aliases while counting each matching reader only once', () => {
    const metrics = calculateDashboardMetrics({
      globalConfig: baseConfig,
      paths: {
        itemCount: 1,
        pageCount: 1,
        items: [
          {
            name: 'legacy',
            source: 'publisher',
            sourceError: '',
            tracks: [],
            bytesReceived: 0,
            bytesSent: 0,
            readers: [
              { id: 'rtmp', type: 'rtmpConnection', protocol: 'rtmp', state: 'read' },
              { id: 'webrtc', type: 'webrtcConnection', protocol: 'webrtc', state: 'read' },
              { id: 'hls', type: 'hlsMuxer', protocol: 'hls', state: 'read' },
            ],
          },
        ],
      },
    });

    expect(metrics).toMatchObject({
      rtmpViewers: 1,
      webRTCViewers: 1,
      hlsViewers: 1,
      totalViewers: 3,
    });
  });

  test('uses zero defaults for disabled protocols and invalid uptime', () => {
    const metrics = calculateDashboardMetrics({
      globalConfig: {
        ...baseConfig,
        rtsp: false,
        rtmp: false,
        rtmpsAddress: ':1936',
        hls: false,
        webrtc: false,
        srt: false,
      },
      serverInfo: {
        version: '',
        started: '',
        uptime: -1,
      },
      paths: {
        itemCount: 1,
        pageCount: 1,
        items: [
          {
            name: 'alpha',
            source: 'publisher',
            sourceError: '',
            tracks: [],
            bytesReceived: 0,
            bytesSent: 0,
            readers: [
              { id: 'rtsp', type: 'rtspSession', state: 'read' },
              { id: 'rtsps', type: 'rtspsSession', state: 'read' },
              { id: 'rtmps', protocol: 'rtmps', type: '', state: 'read' },
            ],
          },
        ],
      },
    });

    expect(metrics.uptime).toBe(0);
    expect(metrics.rtspViewers).toBe(0);
    expect(metrics.rtspsViewers).toBe(0);
    expect(metrics.rtmpsConnections).toBe(0);
    expect(metrics.totalViewers).toBe(0);
  });

  test('formats valid zero-second server uptime instead of displaying it as unavailable', () => {
    const metrics = calculateDashboardMetrics({
      serverInfo: {
        version: 'v1.12.3',
        started: '2026-07-29T11:59:59.500Z',
        uptime: 0,
      },
    });
    const uptimeCard = metrics.cards.find((card) => card.label === 'Uptime');

    expect(uptimeCard).toMatchObject({
      value: 'less than a minute',
      description: 'MediaMTX v1.12.3',
    });
  });

  test('formats uptime at whole-minute precision without seconds', () => {
    const cases = [
      { uptime: 8137, expected: '2 hours, 15 minutes' },
      { uptime: 7200, expected: '2 hours' },
      { uptime: 120, expected: '2 minutes' },
      { uptime: 157, expected: '2 minutes' },
    ];

    for (const { uptime, expected } of cases) {
      const metrics = calculateDashboardMetrics({
        serverInfo: {
          version: '',
          started: '',
          uptime,
        },
      });
      const uptimeCard = metrics.cards.find((card) => card.label === 'Uptime');

      expect(uptimeCard?.value).toBe(expected);
      expect(String(uptimeCard?.value)).not.toMatch(/\bseconds?\b/i);
    }
  });

  test('formats sub-minute uptime clearly while preserving unavailable and version states', () => {
    const subMinuteMetrics = calculateDashboardMetrics({
      serverInfo: {
        version: 'v1.12.3',
        started: '2026-07-29T11:59:01Z',
        uptime: 59,
      },
    });
    const unavailableMetrics = calculateDashboardMetrics({});

    expect(subMinuteMetrics.cards.find((card) => card.label === 'Uptime')).toMatchObject({
      value: 'less than a minute',
      description: 'MediaMTX v1.12.3',
    });
    expect(unavailableMetrics.cards.find((card) => card.label === 'Uptime')?.value).toBe('-');
  });

  test('preserves documented server info and stores uptime derived from started', async () => {
    const originalFetch = globalThis.fetch;
    const originalDateNow = Date.now;
    const requests: string[] = [];
    const now = Date.parse('2026-07-29T12:00:00Z');
    useAppStore.setState({ serverUrl: 'http://mediamtx.test' });
    useMediaMTXApiStore.getState().resetForServerUrl('http://mediamtx.test');
    Date.now = () => now;
    globalThis.fetch = (async (input) => {
      requests.push(String(input));
      return new Response(
        JSON.stringify({
          version: 'v1.12.3',
          started: '2026-07-29T11:57:56.500Z',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as typeof fetch;

    try {
      await refreshServerInfoNow();
      expect(useMediaMTXApiStore.getState().serverInfo.data).toEqual({
        version: 'v1.12.3',
        started: '2026-07-29T11:57:56.500Z',
        uptime: 123,
      });
      expect(requests).toEqual(['http://mediamtx.test/v3/info']);
    } finally {
      Date.now = originalDateNow;
      globalThis.fetch = originalFetch;
    }
  });

  test('clamps absent, invalid, and future started timestamps to zero uptime', async () => {
    const originalFetch = globalThis.fetch;
    const originalDateNow = Date.now;
    const now = Date.parse('2026-07-29T12:00:00Z');
    const responses = [
      { version: 'v1.12.3' },
      { version: 'v1.12.3', started: 'not-a-timestamp' },
      { version: 'v1.12.3', started: '2026-07-29T12:00:01Z' },
    ];
    Date.now = () => now;
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify(responses.shift()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      for (let index = 0; index < 3; index += 1) {
        const info = await getServerInfo();
        expect(info.uptime).toBe(0);
        expect(Number.isFinite(info.uptime)).toBe(true);
      }
    } finally {
      Date.now = originalDateNow;
      globalThis.fetch = originalFetch;
    }
  });

  test('rejects an incomplete year-only started timestamp', async () => {
    const originalFetch = globalThis.fetch;
    const originalDateNow = Date.now;
    Date.now = () => Date.parse('2026-07-29T12:00:00Z');
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ version: 'v1.12.3', started: '2026' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      await expect(getServerInfo()).resolves.toEqual({
        version: 'v1.12.3',
        started: '2026',
        uptime: 0,
      });
    } finally {
      Date.now = originalDateNow;
      globalThis.fetch = originalFetch;
    }
  });

  test('configures paths, config, and server info as mounted store-backed dashboard resources', async () => {
    const dashboardHook = await Bun.file('src/hooks/useDashboardMetrics.ts').text();
    const pathsHook = await Bun.file('src/hooks/useMediaMTXPaths.ts').text();
    const integrationLayer = await Bun.file('src/hooks/useMediaMTXApi.ts').text();
    const serverInfoApi = await Bun.file('src/api/serverInfoApi.ts').text();
    const metricsGrid = await Bun.file('src/components/dashboard/DashboardMetricsGrid.tsx').text();
    const metricsStore = await Bun.file('src/store/useDashboardMetricsStore.ts').text();

    expect(dashboardHook).toContain('useStoreBackedPaths');
    expect(dashboardHook).toContain('useStoreBackedGlobalConfig');
    expect(dashboardHook).toContain('useStoreBackedServerInfo');
    expect(pathsHook).toContain('useStoreBackedPaths');
    expect(integrationLayer).toContain('const LIVE_REFRESH_MS = 3000');
    expect(integrationLayer).toContain("import useSWR, { mutate as mutateSWR } from 'swr'");
    expect(integrationLayer).toContain('pathsKey(serverUrl)');
    expect(integrationLayer).toContain('serverInfoKey(serverUrl)');
    expect(serverInfoApi).toContain('/v3/info');
    expect(integrationLayer).toContain('refreshInterval: LIVE_REFRESH_MS');
    expect(integrationLayer).not.toContain('globalThis.clearInterval');
    expect(metricsGrid).toContain('useDashboardMetrics');
    expect(metricsStore).toContain('calculateDashboardMetrics');
    expect(metricsStore).toContain('paths?.items ?? []');
    expect(metricsStore).toContain('globalConfig');
    expect(metricsStore).toContain('serverInfo');
  });

  test('removes Prometheus metrics while stream paths intentionally fetch path config metadata', async () => {
    const sourceFiles = [
      'src/api/configApi.ts',
      'src/api/serverInfoApi.ts',
      'src/hooks/useMediaMTXApi.ts',
      'src/hooks/useDashboardMetrics.ts',
      'src/store/useMediaMTXApiStore.ts',
      'src/store/useDashboardMetricsStore.ts',
      'src/components/dashboard/DashboardMetricsGrid.tsx',
    ];

    for (const file of sourceFiles) {
      const text = await Bun.file(file).text();
      expect(text).not.toContain('/v3/config/paths/list');
      expect(text).not.toContain('/metrics');
      expect(text).not.toContain('parsePrometheusMetrics');
      expect(text).not.toContain('useServerMetrics');
    }

    const pathsApi = await Bun.file('src/api/pathsApi.ts').text();
    expect(pathsApi).toContain('/v3/paths/list');
    expect(pathsApi).toContain('/v3/config/paths/list');
    expect(pathsApi).not.toContain('/metrics');
    expect(pathsApi).not.toContain('parsePrometheusMetrics');
    expect(pathsApi).not.toContain('useServerMetrics');
  });
});
