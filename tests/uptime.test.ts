import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { calculateDashboardMetrics } from '../src/store/useDashboardMetricsStore';
import { formatUptime } from '../src/utils/formatters';

describe('formatUptime', () => {
  test.each([
    [0, 'less than a minute'],
    [59, 'less than a minute'],
    [60, '1 minute'],
    [3_600, '1 hour'],
    [8_100, '2 hours, 15 minutes'],
    [90_000, '1 day, 1 hour'],
    [8_130, '2 hours, 15 minutes'],
  ])('formats %i seconds without seconds', (seconds, expected) => {
    expect(formatUptime(seconds)).toBe(expected);
    expect(formatUptime(seconds)).not.toMatch(/\bseconds?\b/i);
  });

  test('imports humanize-duration as the non-sub-minute formatter', () => {
    const formatterSource = readFileSync(
      new URL('../src/utils/formatters.ts', import.meta.url),
      'utf8'
    );

    expect(formatterSource).toContain("import humanizeDuration from 'humanize-duration'");
    expect(formatterSource).toContain("units: ['d', 'h', 'm']");
  });
});

describe('UPTIME dashboard card', () => {
  test('shows a dash and unavailable-version description without server information', () => {
    const uptimeCard = calculateDashboardMetrics({}).cards[0];

    expect(uptimeCard.value).toBe('-');
    expect(uptimeCard.description).toBe('MediaMTX version unavailable');
  });

  test('shows readable uptime and MediaMTX version subtext with server information', () => {
    const uptimeCard = calculateDashboardMetrics({
      serverInfo: {
        version: '1.12.3',
        started: '2026-07-29T00:00:00Z',
        uptime: 8_130,
      },
    }).cards[0];

    expect(uptimeCard.value).toBe('2 hours, 15 minutes');
    expect(uptimeCard.description).toBe('MediaMTX 1.12.3');
  });
});
