import { describe, expect, test } from 'bun:test';
import { hasRecordingOnDay } from '../src/components/playbackSync/PlaybackSyncRecordingSidebar';

describe('playback reference layout contract', () => {
  test('uses the requested rail, wall, timeline, and transport composition', async () => {
    const page = await Bun.file('src/pages/PlaybackSyncPage.tsx').text();
    const rail = await Bun.file('src/components/playbackSync/PlaybackSyncRecordingSidebar.tsx').text();
    const timeline = await Bun.file('src/components/playbackSync/PlaybackSyncTimeline.tsx').text();
    const controls = await Bun.file('src/components/playbackSync/PlaybackSyncControls.tsx').text();
    const grid = await Bun.file('src/components/playbackSync/PlaybackSyncGrid.tsx').text();
    const tile = await Bun.file('src/components/playbackSync/PlaybackSyncTile.tsx').text();

    expect(page).toContain("height: '46px'");
    expect(page).toContain("height: 'calc(100vh - 40px)'");
    expect(page).not.toContain('calc(100% + 40px)');
    expect(page).not.toContain("marginLeft: '-8px'");
    expect(page).toContain('Playback');
    expect(page).not.toContain('role="group" aria-label="Grid layout size"');
    expect(page).toContain('<PlaybackSyncRecordingSidebar');
    expect(page).toContain('<PlaybackSyncGrid');
    expect(page).toContain('<PlaybackSyncTimeline');
    expect(page).toContain('<PlaybackSyncControls');
    expect(page.indexOf('<PlaybackSyncGrid')).toBeLessThan(page.indexOf('<PlaybackSyncTimeline'));
    expect(page.indexOf('<PlaybackSyncTimeline')).toBeLessThan(page.indexOf('<PlaybackSyncControls'));
    expect(grid).toContain("'1x2': { slotCount: 2, columns: 2 }");
    expect(grid).toContain('<GridLayoutIcon layout={option} />');
    expect(grid).toContain('bottom: \'100%\'');
    expect(tile).toContain('Drag a recorded stream here to play');
    expect(tile).toContain('registerPlaybackSyncDropTarget');
    expect(await Bun.file('src/components/playbackSync/PlaybackSlotPicker.tsx').exists()).toBe(false);

    expect(rail).toContain("width: '220px'");
    expect(rail).not.toContain('Last recording');
    expect(rail).not.toContain('>Today<');
    expect(rail).toContain('Streams');
    expect(rail).toContain('VideoClipFilled');
    expect(rail).toContain('VideoClipOffFilled');
    expect(rail).not.toContain('Circle12Filled');
    expect(rail).toContain("return `${isAvailable ? 'Recorded' : 'No recorded'} ${date}`");
    expect(rail).toContain('borderTopWidth: 0');
    expect(rail).toContain('borderBottomWidth: 0');

    expect(timeline).toContain("height: '108px'");
    expect(timeline).toContain("userSelect: 'none'");
    expect(timeline).toContain("height: '14px'");
    expect(timeline).not.toContain('>\n          Timeline\n');
    expect(controls).toContain("minHeight: '48px'");
    expect(controls).toContain("flexWrap: 'wrap'");
    expect(controls.indexOf('Seek back 10 seconds')).toBeLessThan(
      controls.indexOf('Play playback')
    );
    expect(controls.indexOf('Play playback')).toBeLessThan(
      controls.indexOf('Seek forward 10 seconds')
    );
    expect(controls).not.toContain('label="Time"');
    expect(controls).toContain('aria-label="Seek to timestamp"');
    expect(controls).toContain('ArrowForwardFilled');
    expect(controls).toContain("transform: 'scaleX(-1)'");
    expect(controls).toContain("minWidth: '44px'");
    expect(controls).toContain('className={styles.playButton}');
    expect(controls).toContain("width: '104px'");
    expect(controls).toContain('className={styles.rateGroup}');
    expect(controls).toContain('>Rate</Label>');
    expect(controls).not.toContain('<Dropdown');
    expect(controls).toContain('size="small"');
  });

  test('reports recording availability for the selected local day', () => {
    const recording = {
      name: 'camera',
      segments: [{ start: '2026-09-12T09:00:00' }],
    };

    expect(hasRecordingOnDay(recording, '2026-09-12')).toBe(true);
    expect(hasRecordingOnDay(recording, '2026-09-11')).toBe(false);
    expect(hasRecordingOnDay({ name: 'empty', segments: [] }, '2026-09-12')).toBe(false);
  });
});
