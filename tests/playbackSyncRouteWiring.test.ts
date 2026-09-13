import { describe, expect, test } from 'bun:test';
import { pathToTab } from '../src/components/layout/AppSidebar';
import { DASHBOARD_ROUTE, PLAYBACK_ROUTE, STREAMS_ROUTE } from '../src/router/routes';

describe('playback route wiring', () => {
  test('exposes the #/playback route constant', () => {
    expect(DASHBOARD_ROUTE).toBe('/');
    expect(STREAMS_ROUTE).toBe('/streams');
    expect(PLAYBACK_ROUTE).toBe('/playback');
  });

  test('maps playback paths to the playback tab', () => {
    expect(pathToTab('/playback')).toBe('playback');
    expect(pathToTab('/playback/cam-1')).toBe('playback');
    expect(pathToTab('/streams')).toBe('streams');
    expect(pathToTab('/')).toBe('dashboard');
    expect(pathToTab('/unknown')).toBe('dashboard');
  });

  test('registers the playback route and page in the app layout', async () => {
    const layout = await Bun.file('src/components/layout/AppLayout.tsx').text();
    expect(layout).toContain(`path={PLAYBACK_ROUTE} element={<PlaybackPage />}`);
    expect(layout).toContain('import PlaybackPage from "@src/pages/PlaybackPage";');
  });

  test('adds the playback sidebar item with the history icon', async () => {
    const sidebar = await Bun.file('src/components/layout/AppSidebar.tsx').text();
    expect(sidebar).toContain("id: 'playback'");
    expect(sidebar).toContain("label: 'Playback'");
    expect(sidebar).toContain('History24Regular');
    expect(sidebar).toContain('PLAYBACK_ROUTE');
  });
});
