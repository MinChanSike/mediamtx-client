import { describe, expect, test } from 'bun:test';
import {
  RecordedPlaybackSyncController,
  MAX_MEDIA_REQUEST_SECONDS,
} from '../src/playbackSync/recordedPlaybackSyncController';
import { SharedClock } from '../src/playbackSync/sharedClock';
import { normalizeSpans } from '../src/utils/playbackSyncIntervals';
import type { PlaybackSpan } from '../src/schemas/recordingSchema';

const T0 = Date.UTC(2026, 0, 2, 0, 0, 0);
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

function span(startOffsetMs: number, durationSec: number): PlaybackSpan {
  return {
    start: new Date(T0 + startOffsetMs).toISOString(),
    duration: durationSec,
    url: `/get?offset=${startOffsetMs}`,
  };
}

class FakeSeekable {
  constructor(private startSec: number, private endSec: number) {}
  get length() {
    return 1;
  }
  start(_index: number) {
    return this.startSec;
  }
  end(_index: number) {
    return this.endSec;
  }
}

class FakeVideo {
  src = '';
  playbackRate = 1;
  currentTime = 0;
  duration = Number.NaN;
  muted = true;
  readyState = 4;
  error: { code: number } | null = null;
  private listeners = new Map<string, Set<() => void>>();
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  removedAttribute: string | null = null;
  seekable = new FakeSeekable(0, 0);

  addEventListener(type: string, handler: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: () => void) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatch(type: string) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler();
    }
  }

  play() {
    this.playCalls += 1;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
  }

  load() {
    this.loadCalls += 1;
  }

  removeAttribute(name: string) {
    this.removedAttribute = name;
    if (name === 'src') this.src = '';
  }

  /** Test helper: simulate the browser finishing metadata and playback start. */
  finishMetadata(durationSec: number) {
    this.duration = durationSec;
    this.seekable = new FakeSeekable(0, durationSec);
    this.readyState = 4;
    this.dispatch('loadedmetadata');
    this.dispatch('canplay');
    this.dispatch('playing');
  }
}

function fakeVideo(): HTMLVideoElement {
  return new FakeVideo() as unknown as HTMLVideoElement;
}

function asFake(video: HTMLVideoElement): FakeVideo {
  return video as unknown as FakeVideo;
}

describe('SharedClock', () => {
  test('freezes while paused and advances by rate while playing', () => {
    let mono = 0;
    const clock = new SharedClock(T0, () => mono);

    expect(clock.positionMs()).toBe(T0);

    clock.play();
    mono += 1000;
    expect(clock.positionMs()).toBe(T0 + 1000);

    clock.pause();
    expect(clock.positionMs()).toBe(T0 + 1000);
    mono += 5000;
    expect(clock.positionMs()).toBe(T0 + 1000);

    clock.play();
    clock.setRate(2);
    mono += 1000;
    expect(clock.positionMs()).toBe(T0 + 3000);

    clock.seek(T0 + HOUR);
    mono += 1000;
    expect(clock.positionMs()).toBe(T0 + HOUR + 2000);
  });
});

describe('RecordedPlaybackSyncController tiles', () => {
  function createController() {
    let mono = 0;
    const controller = new RecordedPlaybackSyncController({
      initialPositionMs: T0 + HOUR * 9,
      nowFn: () => mono,
    });
    return {
      controller,
      advanceMono: (ms: number) => {
        mono += ms;
      },
    };
  }

  test('loads a bounded /get URL from the shared timestamp inside the containing span', () => {
    const { controller } = createController();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 7200)]));
    controller.seekTo(T0 + HOUR * 9 + 30 * MIN);

    const fake = asFake(video);
    expect(fake.src).toContain('http://play.test:9996/get?');
    expect(fake.src).toContain('path=cam-a');
    // Bounded to five minutes even though the span has two hours left.
    expect(fake.src).toContain('duration=300.000');
    expect(fake.src).toContain(`start=${encodeURIComponent('2026-01-02T09:30:00.000Z')}`);
    expect(fake.src).toContain('format=fmp4');
  });

  test('shortens the media request when the interval ends first', () => {
    const { controller } = createController();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 60)]));
    controller.seekTo(T0 + HOUR * 9 + 30 * 1000); // 30s remain in the interval

    const fake = asFake(video);
    expect(fake.src).toContain('duration=30.000');
  });

  test('marks no-recording, gap, and endpoint-error states distinctly', () => {
    const { controller } = createController();

    const videoEmpty = fakeVideo();
    controller.attachVideo(0, 'empty-cam', videoEmpty);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('empty-cam', normalizeSpans([]));
    expect(controller.getSnapshot().tiles['0']).toMatchObject({ status: 'no-recording' });

    const videoGap = fakeVideo();
    controller.attachVideo(1, 'gap-cam', videoGap);
    controller.setSpans('gap-cam', normalizeSpans([span(HOUR * 9, 3600)]));
    controller.seekTo(T0 + HOUR * 12);
    expect(controller.getSnapshot().tiles['1']).toMatchObject({ status: 'gap' });

    const controller2 = new RecordedPlaybackSyncController({ initialPositionMs: T0 });
    const videoNoEndpoint = fakeVideo();
    controller2.attachVideo(0, 'cam-a', videoNoEndpoint);
    controller2.setEndpoint(null);
    expect(controller2.getSnapshot().tiles['0']).toMatchObject({
      status: 'error',
      errorCode: 'endpoint',
    });
  });

  test('classifies decode errors and retries from the shared timestamp', () => {
    const { controller } = createController();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 3600)]));
    controller.seekTo(T0 + HOUR * 9);

    const fake = asFake(video);
    fake.error = { code: 4 }; // MEDIA_ERR_SRC_NOT_SUPPORTED
    fake.dispatch('error');

    expect(controller.getSnapshot().tiles['0']).toMatchObject({
      status: 'error',
      errorCode: 'decode',
    });

    controller.retryTile(0);
    expect(controller.getSnapshot().tiles['0']).toMatchObject({ status: 'loading' });
    expect(fake.playCalls).toBeGreaterThanOrEqual(0);
  });

  test('aborted errors from reloads are ignored', () => {
    const { controller } = createController();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 3600)]));
    controller.seekTo(T0 + HOUR * 9);

    const fake = asFake(video);
    fake.error = { code: 1 }; // MEDIA_ERR_ABORTED
    fake.dispatch('error');

    expect(controller.getSnapshot().tiles['0']).toMatchObject({ status: 'loading' });
  });

  test('chains the next interval chunk when a bounded request ends', () => {
    const { controller } = createController();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 7200)]));

    controller.play();
    controller.seekTo(T0 + HOUR * 9);
    const fake = asFake(video);
    fake.finishMetadata(300);

    // Five minutes elapse on the shared clock; the element reaches its end.
    controller.pause();
    controller.seekTo(T0 + HOUR * 9 + 5 * MIN);
    controller.play();
    fake.currentTime = 300;
    fake.dispatch('ended');

    // The next request starts at the shared timestamp (five minutes in).
    expect(fake.src).toContain(`start=${encodeURIComponent('2026-01-02T09:05:00.000Z')}`);
    expect(fake.src).toContain('duration=300.000');
  });

  test('pausing stops playback without tearing down media', () => {
    const { controller } = createController();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 3600)]));
    controller.play();

    const fake = asFake(video);
    fake.finishMetadata(300);
    expect(fake.playCalls).toBeGreaterThan(0);

    controller.pause();
    expect(fake.pauseCalls).toBeGreaterThan(0);
    expect(fake.removedAttribute).toBeNull();
    expect(controller.isPlaying()).toBe(false);
  });

  test('audio follows the selected slot and mutes the rest', () => {
    const { controller } = createController();
    const videoA = fakeVideo();
    const videoB = fakeVideo();
    controller.attachVideo(0, 'cam-a', videoA);
    controller.attachVideo(1, 'cam-b', videoB);

    expect(asFake(videoA).muted).toBe(true);
    expect(asFake(videoB).muted).toBe(true);

    controller.setAudioSlot(1);
    expect(asFake(videoA).muted).toBe(true);
    expect(asFake(videoB).muted).toBe(false);

    controller.setAudioSlot(null);
    expect(asFake(videoB).muted).toBe(true);
  });

  test('rate changes apply to the shared clock and every element', () => {
    const { controller } = createController();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 3600)]));
    controller.play();

    controller.setRate(4);
    const fake = asFake(video);
    expect(fake.playbackRate).toBe(4);
    expect(controller.getRate()).toBe(4);
  });

  test('detach and dispose release media resources', () => {
    const { controller } = createController();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 3600)]));
    controller.seekTo(T0 + HOUR * 9);

    const fake = asFake(video);
    controller.detachVideo(0);
    expect(fake.removedAttribute).toBe('src');
    expect(fake.loadCalls).toBeGreaterThan(0);
    expect(controller.getSnapshot().tiles['0']).toBeUndefined();

    const video2 = fakeVideo();
    controller.attachVideo(1, 'cam-b', video2);
    controller.dispose();
    expect(asFake(video2).removedAttribute).toBe('src');
    expect(controller.isDisposed()).toBe(true);
  });
});

describe('RecordedPlaybackSyncController synchronization', () => {
  function setup(monotonicMs = 0) {
    let mono = monotonicMs;
    const controller = new RecordedPlaybackSyncController({
      initialPositionMs: T0,
      nowFn: () => mono,
    });
    return {
      controller,
      advance: (ms: number) => {
        mono += ms;
      },
    };
  }

  test('corrects drift beyond one second by seeking inside seekable media', () => {
    const { controller, advance } = setup();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(0, 7200)]));
    controller.play();
    controller.seekTo(T0);
    controller.play();

    const fake = asFake(video);
    fake.finishMetadata(300);

    // The element stalls 5s behind the shared clock.
    advance(5000 + 1500);
    fake.currentTime = 0.5;
    fake.readyState = 4;
    controller.runSyncPass();

    // Target is ~6.5s in, inside seekable [0, 300].
    expect(fake.currentTime).toBeCloseTo(6.5, 2);
  });

  test('reloads a tile at the shared timestamp when the target is not seekable', () => {
    const { controller, advance } = setup();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(0, 7200)]));
    controller.seekTo(T0);
    controller.play();

    const fake = asFake(video);
    fake.finishMetadata(300);

    // The element falls far behind; the target lies outside seekable media.
    advance(20 * MIN);
    fake.currentTime = 1;
    fake.readyState = 4;
    const loadsBefore = fake.loadCalls;
    controller.runSyncPass();

    expect(fake.loadCalls).toBeGreaterThan(loadsBefore);
    expect(fake.src).toContain(`start=${encodeURIComponent('2026-01-02T00:20:00.000Z')}`);
  });

  test('skips shared-clock gaps only when every stream lacks footage', () => {
    const { controller } = setup();
    const videoA = fakeVideo();
    const videoB = fakeVideo();
    controller.attachVideo(0, 'cam-a', videoA);
    controller.attachVideo(1, 'cam-b', videoB);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 3600)]));
    controller.setSpans('cam-b', normalizeSpans([span(HOUR * 10, 1800)]));

    // Start inside a universal gap (midnight): both tiles wait, playback skips
    // to the earliest footage across streams.
    controller.seekTo(T0);
    controller.play();
    expect(controller.getSnapshot().tiles['0']).toMatchObject({ status: 'gap' });
    expect(controller.getSnapshot().tiles['1']).toMatchObject({ status: 'gap' });

    controller.runSyncPass();
    expect(controller.getPositionMs()).toBe(T0 + HOUR * 9);
    expect(controller.getSnapshot().tiles['0']).toMatchObject({ status: 'loading' });
    // cam-b has no footage at 09:00 and stays in the gap state.
    expect(controller.getSnapshot().tiles['1']).toMatchObject({ status: 'gap' });

    // At 09:30 cam-a has footage, so no skip fires even though cam-b is in a gap.
    controller.seekTo(T0 + HOUR * 9 + 30 * MIN);
    controller.runSyncPass();
    expect(controller.getPositionMs()).toBe(T0 + HOUR * 9 + 30 * MIN);
  });

  test('does not skip while interval data is still loading', () => {
    const { controller } = setup();
    const videoA = fakeVideo();
    controller.attachVideo(0, 'cam-a', videoA);
    controller.attachVideo(1, 'cam-b', fakeVideo());
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 3600)]));
    // cam-b spans never arrive.

    controller.seekTo(T0);
    controller.play();
    controller.runSyncPass();

    expect(controller.getPositionMs()).toBe(T0);
  });

  test('recovers a gap tile when refreshed intervals cover the shared timestamp', () => {
    const { controller } = setup();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 10, 3600)]));
    controller.seekTo(T0 + HOUR * 9);

    expect(controller.getSnapshot().tiles['0']).toMatchObject({ status: 'gap' });

    // A 30-second availability refresh brings earlier footage.
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 3600), span(HOUR * 10, 3600)]));

    expect(controller.getSnapshot().tiles['0']).toMatchObject({ status: 'loading' });
    const fake = asFake(video);
    expect(fake.src).toContain(`start=${encodeURIComponent('2026-01-02T09:00:00.000Z')}`);
  });

  test('keeps a ready tile playing when intervals refresh without affecting it', () => {
    const { controller } = setup();
    const video = fakeVideo();
    controller.attachVideo(0, 'cam-a', video);
    controller.setEndpoint('http://play.test:9996');
    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 7200)]));
    controller.seekTo(T0 + HOUR * 9);
    controller.play();

    const fake = asFake(video);
    fake.finishMetadata(300);
    const srcBefore = fake.src;
    const playCallsBefore = fake.playCalls;

    controller.setSpans('cam-a', normalizeSpans([span(HOUR * 9, 7200)]));

    expect(fake.src).toBe(srcBefore);
    expect(fake.playCalls).toBe(playCallsBefore);
    expect(controller.getSnapshot().tiles['0']).toMatchObject({ status: 'ready' });
  });
});
