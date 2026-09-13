import { describe, expect, test } from 'bun:test';
import { pathToTab } from '../src/components/layout/AppSidebar';
import { DASHBOARD_ROUTE, PLAYBACK_SYNC_ROUTE, STREAMS_ROUTE } from '../src/router/routes';

describe('playback sync route wiring', () => {
  test('exposes the #/playback-sync route constant', () => {
    expect(DASHBOARD_ROUTE).toBe('/');
    expect(STREAMS_ROUTE).toBe('/streams');
    expect(PLAYBACK_SYNC_ROUTE).toBe('/playback-sync');
  });

  test('maps playback-sync paths to the playback-sync tab', () => {
    expect(pathToTab('/playback-sync')).toBe('playback-sync');
    expect(pathToTab('/playback-sync/cam-1')).toBe('playback-sync');
    expect(pathToTab('/streams')).toBe('streams');
    expect(pathToTab('/')).toBe('dashboard');
    expect(pathToTab('/unknown')).toBe('dashboard');
  });

  test('registers the playback-sync route and page in the app layout', async () => {
    const layout = await Bun.file('src/components/layout/AppLayout.tsx').text();
    expect(layout).toContain(`path={PLAYBACK_SYNC_ROUTE} element={<PlaybackSyncPage />}`);
    expect(layout).toContain('import PlaybackSyncPage from "@src/pages/PlaybackSyncPage";');
  });

  test('adds the playback-sync sidebar item with the history icon', async () => {
    const sidebar = await Bun.file('src/components/layout/AppSidebar.tsx').text();
    expect(sidebar).toContain("id: 'playback-sync'");
    expect(sidebar).toContain("label: 'Playback Sync'");
    expect(sidebar).toContain('History24Regular');
    expect(sidebar).toContain('PLAYBACK_SYNC_ROUTE');
  });
});
