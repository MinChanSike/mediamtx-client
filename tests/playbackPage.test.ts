import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { pathToTab } from '../src/components/layout/AppSidebar';
import { PLAYBACK_ROUTE } from '../src/router/routes';
import {
  MAX_FILE_WINDOW_MS,
  WINDOW_ROLLOVER_MARGIN_MS,
  buildFileDownloadUrl,
  buildFileSourceUrl,
  buildFileWindowSourceUrl,
  buildWindowSourceUrl,
  fetchRecordedFiles,
  findAdjacentFile,
  recordedFileKey,
  sortRecordedFiles,
  type RecordedFile,
} from '../src/api/playbackApi';
import {
  formatFileDuration,
  formatFilePosition,
  formatFileRecordedAt,
  formatFileStartDate,
  formatFileStartLabel,
  getVisibleRecordedFiles,
} from '../src/utils/recordedFileFormat';
import usePlaybackStore, {
  PLAYBACK_PREFERENCES_STORAGE_KEY,
  createPlaybackStore,
} from '../src/store/usePlaybackStore';

const layoutSource = readFileSync(
  new URL('../src/components/layout/AppLayout.tsx', import.meta.url),
  'utf8'
);
const sidebarSource = readFileSync(
  new URL('../src/components/layout/AppSidebar.tsx', import.meta.url),
  'utf8'
);
const pageSource = readFileSync(
  new URL('../src/pages/PlaybackPage.tsx', import.meta.url),
  'utf8'
);
const seekBarSource = readFileSync(
  new URL('../src/components/playback/PlaybackSeekBar.tsx', import.meta.url),
  'utf8'
);
const fileListSource = readFileSync(
  new URL('../src/components/playback/PlaybackFileList.tsx', import.meta.url),
  'utf8'
);
const viewerSource = readFileSync(
  new URL('../src/components/playback/PlaybackViewer.tsx', import.meta.url),
  'utf8'
);
const toolbarSource = readFileSync(
  new URL('../src/components/playback/PlaybackToolbar.tsx', import.meta.url),
  'utf8'
);

function makeFile(startIso: string, durationSec: number): { start: string; duration: number } {
  return { start: startIso, duration: durationSec };
}

describe('playback page route wiring', () => {
  test('exposes the #/playback route constant and tab mapping', () => {
    expect(PLAYBACK_ROUTE).toBe('/playback');
    expect(pathToTab('/playback')).toBe('playback');
    expect(pathToTab('/playback/some')).toBe('playback');
    expect(pathToTab('/playback-sync')).toBe('playback-sync');
  });

  test('registers the playback page and sidebar item separately from sync', async () => {
    expect(layoutSource).toContain(`path={PLAYBACK_ROUTE} element={<PlaybackPage />}`);
    expect(layoutSource).toContain('import PlaybackPage from "@src/pages/PlaybackPage";');
    expect(sidebarSource).toContain("id: 'playback'");
    expect(sidebarSource).toContain("label: 'Playback'");
    expect(sidebarSource).toContain('PLAYBACK_ROUTE');
    expect(sidebarSource).toContain('VideoClip24Regular');
  });
});

describe('recorded file helpers', () => {
  test('sorts and normalizes playback spans into ascending files', () => {
    const files = sortRecordedFiles([
      makeFile('2026-09-12T09:00:02Z', 60.5),
      makeFile('2026-09-12T08:00:00Z', 12),
    ]);

    expect(files).toHaveLength(2);
    expect(files[0].startIso).toBe('2026-09-12T08:00:00Z');
    expect(files[0].durationMs).toBe(12000);
    expect(files[1].startMs).toBeGreaterThan(files[0].startMs);
  });

  test('drops spans with unparsable start timestamps', () => {
    expect(sortRecordedFiles([makeFile('not-a-date', 5)])).toHaveLength(0);
  });

  test('finds adjacent files by key and clamps at the list bounds', () => {
    const files = sortRecordedFiles([
      makeFile('2026-09-12T08:00:00Z', 10),
      makeFile('2026-09-12T09:00:00Z', 10),
      makeFile('2026-09-12T10:00:00Z', 10),
    ]);
    const [first, second] = files;

    expect(findAdjacentFile(files, recordedFileKey(first), 1)).toBe(files[1]);
    expect(findAdjacentFile(files, recordedFileKey(second), -1)).toBe(first);
    expect(findAdjacentFile(files, recordedFileKey(files[2]), 1)).toBeNull();
    expect(findAdjacentFile(files, recordedFileKey(first), -1)).toBeNull();
    expect(findAdjacentFile(files, null, 1)).toBe(first);
    expect(findAdjacentFile([], null, 1)).toBeNull();
  });

  test('builds streamable fMP4 sources and plain-file download URLs', () => {
    const file: RecordedFile = { startIso: '2026-09-12T08:00:00Z', startMs: 1789152000000, durationMs: 65000 };

    const sourceUrl = buildFileSourceUrl('http://localhost:9996', 'cam', file);
    expect(sourceUrl).toContain('http://localhost:9996/get?');
    expect(sourceUrl).toContain('path=cam');
    expect(sourceUrl).toContain('format=fmp4');
    expect(sourceUrl).toContain('duration=65.000');

    const downloadUrl = buildFileDownloadUrl('http://localhost:9996', 'cam', file);
    expect(downloadUrl).toContain('/get?');
    expect(downloadUrl).toContain('path=cam');
    expect(downloadUrl).not.toContain('format=');
  });

  test('builds bounded window sources anchored at the requested position', () => {
    const windowUrl = buildWindowSourceUrl('http://localhost:9996', 'cam', 1789152000000, 300_000);
    const expectedStart = encodeURIComponent(new Date(1789152000000).toISOString());
    expect(windowUrl).toContain(`start=${expectedStart}`);
    expect(windowUrl).toContain('duration=300.000');
    expect(windowUrl).toContain('format=fmp4');
    expect(MAX_FILE_WINDOW_MS).toBe(300_000);
    expect(WINDOW_ROLLOVER_MARGIN_MS).toBe(5_000);
  });

  test('preserves exact MediaMTX segment timestamps for initial file playback', () => {
    const file = sortRecordedFiles([
      makeFile('2026-09-13T23:35:50.577972+12:00', 224.741),
    ])[0];

    const sourceUrl = buildFileWindowSourceUrl(
      'http://localhost:9996',
      'stream_19100_6827',
      file,
      0,
      file.durationMs
    );
    const downloadUrl = buildFileDownloadUrl('http://localhost:9996', 'stream_19100_6827', file);
    const expectedStart = 'start=2026-09-13T23%3A35%3A50.577972%2B12%3A00';

    expect(sourceUrl).toContain(expectedStart);
    expect(downloadUrl).toContain(expectedStart);
    expect(sourceUrl).not.toContain('2026-09-13T11%3A35%3A50.577Z');
  });
});

describe('playback file formatting and view controls', () => {
  test('formats local recording dates and times', () => {
    const startMs = new Date(2026, 8, 13, 14, 49, 25).getTime();

    expect(formatFileStartDate(startMs)).toBe('2026-09-13');
    expect(formatFileStartLabel(startMs)).toBe('14:49:25');
    expect(formatFileRecordedAt(startMs)).toBe('2026-09-13 14:49:25');
  });

  test('filters by partial date or time and sorts without mutating the source array', () => {
    const morning: RecordedFile = {
      startIso: '2026-09-12T08:15:30Z',
      startMs: new Date(2026, 8, 12, 8, 15, 30).getTime(),
      durationMs: 10_000,
    };
    const afternoon: RecordedFile = {
      startIso: '2026-09-13T14:49:25Z',
      startMs: new Date(2026, 8, 13, 14, 49, 25).getTime(),
      durationMs: 20_000,
    };
    const source = [morning, afternoon];

    expect(getVisibleRecordedFiles(source, '09-13', 'ascending')).toEqual([afternoon]);
    expect(getVisibleRecordedFiles(source, '2026-09-13 14:49:25', 'ascending')).toEqual([afternoon]);
    expect(getVisibleRecordedFiles(source, '14:49', 'ascending')).toEqual([afternoon]);
    expect(getVisibleRecordedFiles(source, '20_000', 'ascending')).toEqual([]);
    expect(getVisibleRecordedFiles(source, '  ', 'ascending')).toEqual([morning, afternoon]);
    expect(getVisibleRecordedFiles(source, '', 'descending')).toEqual([afternoon, morning]);
    expect(getVisibleRecordedFiles(source, 'not-found', 'ascending')).toEqual([]);
    expect(source).toEqual([morning, afternoon]);
  });

  test('formats compact durations', () => {
    expect(formatFileDuration(0)).toBe('0s');
    expect(formatFileDuration(45000)).toBe('45s');
    expect(formatFileDuration(252000)).toBe('4m 12s');
    expect(formatFileDuration(3_780_000)).toBe('1h 03m');
  });

  test('formats elapsed positions', () => {
    expect(formatFilePosition(0)).toBe('0:00');
    expect(formatFilePosition(45000)).toBe('0:45');
    expect(formatFilePosition(65000)).toBe('1:05');
    expect(formatFilePosition(3_792_000)).toBe('1:03:12');
  });
});

describe('playback file store', () => {
  afterEach(() => {
    usePlaybackStore.setState({ autoplayEnabled: false, rate: 1 });
  });

  test('starts with autoplay off and rate 1x', () => {
    const store = createPlaybackStore({
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    const state = store.getState();

    expect(state.autoplayEnabled).toBe(false);
    expect(state.rate).toBe(1);
  });

  test('toggles autoplay and updates the rate, ignoring invalid rates', () => {
    usePlaybackStore.getState().setAutoplayEnabled(true);
    usePlaybackStore.getState().setRate(2);
    expect(usePlaybackStore.getState().autoplayEnabled).toBe(true);
    expect(usePlaybackStore.getState().rate).toBe(2);

    usePlaybackStore.getState().setRate(3 as never);
    expect(usePlaybackStore.getState().rate).toBe(1);
  });

  test('uses its own preferences storage key', () => {
    expect(PLAYBACK_PREFERENCES_STORAGE_KEY).toBe('mediamtx-playback-file-preferences');
  });
});

describe('playback page composition', () => {
  test('composes the stream list, file list, viewer, seek bar, and toolbar', () => {
    for (const component of [
      '<PlaybackStreamList',
      '<PlaybackFileList',
      '<PlaybackViewer',
      '<PlaybackSeekBar',
      '<PlaybackToolbar',
    ]) {
      expect(pageSource).toContain(component);
    }
    expect(pageSource).toContain('autoplayEnabled');
    expect(pageSource).toContain('buildFileDownloadUrl');
    expect(pageSource).toContain('findAdjacentFile');
  });

  test('uses the shared page header with playback subtext', () => {
    expect(pageSource).toContain("import PageHeader from '@src/components/common/PageHeader';");
    expect(pageSource).toContain('title="Playback"');
    expect(pageSource).toContain(
      'subtitle="Recorded stream playback on the MediaMTX server"'
    );
    expect(pageSource).not.toContain('topBar: {');
  });

  test('matches the Streams viewport-bound flex layout', () => {
    expect(pageSource).toMatch(
      /root: \{[\s\S]*?height: 'calc\(100vh - 40px\)'[\s\S]*?minHeight: 0[\s\S]*?minWidth: 0[\s\S]*?gap: tokens\.spacingVerticalM[\s\S]*?overflow: 'hidden'/
    );
    expect(pageSource).toMatch(
      /workspace: \{[\s\S]*?minWidth: 0[\s\S]*?minHeight: 0[\s\S]*?flex: 1[\s\S]*?overflow: 'hidden'/
    );
  });

  test('wraps the workspace in a single outer border owned by the page', () => {
    expect(pageSource).toMatch(
      /workspace: \{[\s\S]*?border: `\$\{tokens\.strokeWidthThin\} solid \$\{tokens\.colorNeutralStroke2\}`/
    );
    expect(pageSource).toContain('fullDurationMs');
  });

  test('timeline tracks playback via rAF and spans the full recorded length', () => {
    expect(seekBarSource).toContain('requestAnimationFrame(tick)');
    expect(seekBarSource).toMatch(/video\.addEventListener\(["']seeked["'], sample\)/);
    expect(seekBarSource).toMatch(/video\.addEventListener\(["']timeupdate["'], sample\)/);
    expect(seekBarSource).toContain('fullDurationMs');
    expect(seekBarSource).toContain('windowStartMs + Math.round(video.currentTime * 1000)');
  });

  test('timeline colors stay visible in both themes', () => {
    expect(seekBarSource).toContain('colorNeutralStrokeAccessible');
    expect(seekBarSource).toContain('colorBrandForeground1');
    expect(seekBarSource).not.toContain('colorBrandBackground2');
  });

  test('timeline shows only position labels and the bottom toolbar shows full recorded time', () => {
    expect(seekBarSource).toMatch(/root: \{[\s\S]*?flexDirection: ["']column["']/);
    expect(seekBarSource).toMatch(
      /timeRow: \{[\s\S]*?justifyContent: ["']space-between["']/
    );
    expect(seekBarSource).not.toContain('Recorded at');
    expect(seekBarSource).not.toContain('formatFileRecordedAt');
    expect(toolbarSource).toContain('formatFileRecordedAt');
    expect(toolbarSource).toContain('`Recorded at ${formatFileRecordedAt(fileStartMs)}`');
    expect(pageSource).toContain('fileStartMs={selectedFile?.startMs ?? null}');
  });

  test('play state is reconciled when a window swap remounts the video', () => {
    expect(pageSource).toMatch(
      /const shouldStart = shouldAutoStartRef\.current;[\s\S]*?setIsPlaying\(false\)/
    );
  });

  test('player uses bounded windows and fresh requests for out-of-range seeks', () => {
    expect(pageSource).toContain('buildFileWindowSourceUrl');
    expect(pageSource).toContain('openWindowAt');
    expect(pageSource).toContain('WINDOW_ROLLOVER_MARGIN_MS');
    expect(pageSource).toContain("video.buffered");
  });

  test('file list shows recorded-at titles, durations, filter, and sort controls', () => {
    expect(fileListSource).toContain('const recordedAt = formatFileRecordedAt(file.startMs)');
    expect(fileListSource).toContain('{recordedAt}');
    expect(fileListSource).toContain('{formatFileDuration(file.durationMs)}');
    expect(fileListSource).toContain('aria-label="Toggle file filter"');
    expect(fileListSource).toContain('aria-label="Filter recorded files by date or time"');
    expect(fileListSource).toContain("'Sort files newest first'");
    expect(fileListSource).toContain("'Sort files oldest first'");
    expect(fileListSource).toContain('ArrowSortDownLinesRegular');
    expect(fileListSource).toContain('ArrowSortUpLinesRegular');
    expect(fileListSource).not.toContain('ArrowSortDown16Regular');
    expect(fileListSource).not.toContain('ArrowSortUp16Regular');
    expect(fileListSource).toContain('visibleFiles.map');
    expect(fileListSource).toContain('No matching files');
  });

  test('download spinner clears when the download promise settles', () => {
    expect(fileListSource).toContain('onDownload: (file: RecordedFile) => Promise<void>');
    expect(fileListSource).toMatch(
      /\.finally\(\(\) => \{[\s\S]*?setDownloadingKey\(\(current\) => \(current === key \? null : current\)\)/
    );
  });

  test('viewer shows a hover-only close button without a header', () => {
    expect(viewerSource).toContain('playback-viewer-close');
    expect(viewerSource).toContain('<CloseButton');
    expect(viewerSource).toContain('onClose: () => void');
    expect(viewerSource).not.toContain('PlaybackHeader');
  });
});

describe('fetchRecordedFiles HTTP behavior', () => {
  test('maps 404 answers to an empty list', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch;
    try {
      expect(await fetchRecordedFiles('http://localhost:9996', 'missing')).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
