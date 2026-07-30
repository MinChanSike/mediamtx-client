import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const videoPlayerSource = readFileSync(
  new URL('../src/components/streams/VideoPlayer.tsx', import.meta.url),
  'utf8'
);

describe('VideoPlayer sizing', () => {
  test('uses contain fitting for both grid fillCell and normal video modes', () => {
    expect(videoPlayerSource).toContain('className="h-full w-full object-contain"');
    expect(videoPlayerSource).not.toContain('object-cover');
    expect(videoPlayerSource).not.toContain("fillCell ? 'object-cover'");
  });

  test('keeps the video centered in its black container without changing controls', () => {
    expect(videoPlayerSource).toContain('items-center justify-center');
    expect(videoPlayerSource).toContain('bg-black');
    expect(videoPlayerSource).toContain('onClick={retry}');
    expect(videoPlayerSource).toContain('onClick={handleFullscreen}');
    expect(videoPlayerSource).toContain('onClick={toggleMute}');
    expect(videoPlayerSource).toContain('onClick={play}');
  });
});
