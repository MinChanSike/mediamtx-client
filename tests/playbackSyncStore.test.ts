import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  createPlaybackStore,
  PLAYBACK_SYNC_PREFERENCES_STORAGE_KEY,
  type PlaybackState,
} from '../src/store/usePlaybackSyncStore';
import { buildSpansKey, isSameSpanIdentity } from '../src/hooks/usePlaybackSyncSpans';
import type { StateStorage } from 'zustand/middleware';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = new MemoryStorage();
const stateStorage: StateStorage = storage;

const DAY = '2026-01-02';
const OTHER_DAY = '2026-01-03';
const DAY_START = new Date(2026, 0, 2).getTime();

let store: ReturnType<typeof createPlaybackStore>;

function resetStore() {
  storage.clear();
  store = createPlaybackStore(stateStorage, new Date(DAY_START + 12 * 60 * 60 * 1000).getTime());
}

beforeEach(resetStore);

afterEach(() => {
  storage.clear();
});

describe('playback store', () => {
  test('defaults to today, paused, muted, and a 2x2 layout', () => {
    const state: PlaybackState = store.getState();
    expect(state.selectedDay).toBe(DAY);
    expect(state.isPlaying).toBe(false);
    expect(state.audioSlot).toBeNull();
    expect(state.rate).toBe(1);
    expect(state.layout).toBe('2x2');
    expect(state.sharedTimestampMs).toBe(DAY_START);
    expect(state.slots.size).toBe(0);
  });

  test('assigns and removes slots with bounds checks', () => {
    const { setSlot, clearSlot } = store.getState();

    setSlot(0, 'cam-a');
    setSlot(3, 'cam-d');
    setSlot(4, 'ignored');
    setSlot(1, '   ');
    expect(Array.from(store.getState().slots.entries())).toEqual([
      [0, 'cam-a'],
      [3, 'cam-d'],
    ]);

    // Clearing the audio slot clears audio with it.
    store.getState().setAudioSlot(3);
    clearSlot(3);
    expect(store.getState().slots.has(3)).toBe(false);
    expect(store.getState().audioSlot).toBeNull();
  });

  test('day changes reset the clock to the new local midnight and pause playback', () => {
    const otherDayStart = new Date(2026, 0, 3).getTime();
    store.getState().setIsPlaying(true);
    store.getState().setSharedTimestamp(DAY_START + 3600_000);

    store.getState().setSelectedDay(OTHER_DAY);

    expect(store.getState().selectedDay).toBe(OTHER_DAY);
    expect(store.getState().sharedTimestampMs).toBe(otherDayStart);
    expect(store.getState().isPlaying).toBe(false);

    // Same-day and malformed day keys are ignored.
    store.getState().setSelectedDay(OTHER_DAY);
    store.getState().setSelectedDay('not-a-day');
    expect(store.getState().selectedDay).toBe(OTHER_DAY);
  });

  test('persists endpoint overrides per API server', () => {
    const { setEndpointOverride } = store.getState();

    setEndpointOverride('http://api-one.test:9997', 'http://one-playback.test:9996');
    setEndpointOverride('http://api-two.test:9997', 'http://two-playback.test:9996');
    setEndpointOverride('http://api-two.test:9997', null);

    const overrides = store.getState().endpointOverrides;
    expect(overrides).toEqual({ 'http://api-one.test:9997': 'http://one-playback.test:9996' });
  });

  test('rate changes only accept the supported rates', () => {
    const { setRate } = store.getState();

    setRate(4);
    expect(store.getState().rate).toBe(4);

    setRate(3 as never);
    expect(store.getState().rate).toBe(1);
  });

  test('persisted preferences restore layout, slots, and endpoint overrides only', () => {
    store.getState().setLayout('1x2');
    store.getState().setSlot(1, 'cam-b');
    store.getState().setEndpointOverride('http://api.test:9997', 'http://playback.test:9996');
    store.getState().setRate(2);
    store.getState().setAudioSlot(1);
    store.getState().setSelectedDay(OTHER_DAY);

    const restored = createPlaybackStore(
      stateStorage,
      new Date(DAY_START + 12 * 60 * 60 * 1000).getTime()
    ).getState();

    expect(restored.layout).toBe('1x2');
    expect(Array.from(restored.slots.entries())).toEqual([[1, 'cam-b']]);
    expect(restored.endpointOverrides).toEqual({
      'http://api.test:9997': 'http://playback.test:9996',
    });
    // Session state is not persisted: today wins over the previously open day.
    expect(restored.selectedDay).toBe(DAY);
    expect(restored.isPlaying).toBe(false);
    expect(restored.audioSlot).toBeNull();

    const raw = JSON.parse(storage.getItem(PLAYBACK_SYNC_PREFERENCES_STORAGE_KEY)!);
    expect(raw.state.slots).toEqual([[1, 'cam-b']]);
    expect(raw.state.selectedDay).toBeUndefined();
  });

  test('migrates the previous 1x1 playback preference to 1x2', () => {
    storage.setItem(
      PLAYBACK_SYNC_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ state: { layout: '1x1', slots: [], endpointOverrides: {} }, version: 0 })
    );

    const restored = createPlaybackStore(stateStorage, DAY_START).getState();
    expect(restored.layout).toBe('1x2');
  });

  test('restores only valid slot entries and layouts', () => {
    storage.setItem(
      PLAYBACK_SYNC_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        state: {
          layout: '3x3',
          slots: [[0, 'cam-a'], [9, 'ignored'], ['x', 'ignored'], [2, '']],
          endpointOverrides: { api: 42 },
        },
        version: 0,
      })
    );

    const restored = createPlaybackStore(
      stateStorage,
      new Date(DAY_START + 12 * 60 * 60 * 1000).getTime()
    ).getState();

    expect(restored.layout).toBe('2x2');
    expect(Array.from(restored.slots.entries())).toEqual([[0, 'cam-a']]);
    expect(restored.endpointOverrides).toEqual({});
  });
});

describe('playback interval identity guard', () => {
  test('keys spans by endpoint, path, and day', () => {
    expect(buildSpansKey('prefix', { endpoint: 'http://p:9996', path: 'a/b', day: DAY })).toEqual([
      'prefix',
      'http://p:9996',
      'a/b',
      DAY,
    ]);
  });

  test('rejects stale responses after server, endpoint, path, or day changes', () => {
    const captured = { endpoint: 'http://p:9996', path: 'cam', day: DAY };

    expect(isSameSpanIdentity(captured, { endpoint: 'http://p:9996', path: 'cam', day: DAY })).toBe(
      true
    );
    expect(
      isSameSpanIdentity(captured, { endpoint: 'http://other:9996', path: 'cam', day: DAY })
    ).toBe(false);
    expect(
      isSameSpanIdentity(captured, { endpoint: 'http://p:9996', path: 'cam2', day: DAY })
    ).toBe(false);
    expect(
      isSameSpanIdentity(captured, { endpoint: 'http://p:9996', path: 'cam', day: OTHER_DAY })
    ).toBe(false);
  });
});
