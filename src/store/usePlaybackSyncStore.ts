import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { getDayRangeMs, todayDayKey } from '@src/utils/playbackSyncTime';

export type PlaybackLayout = '1x2' | '2x2';
export type PlaybackRate = 0.5 | 1 | 2 | 4;

export const PLAYBACK_SLOT_COUNT = 4;
export const PLAYBACK_RATES: readonly PlaybackRate[] = [0.5, 1, 2, 4] as const;

export interface PlaybackState {
  /** Slot index (0-3) -> recorded path name. */
  slots: Map<number, string>;
  layout: PlaybackLayout;
  /** API server URL -> user-editable playback base URL override. */
  endpointOverrides: Record<string, string>;
  /** Local `YYYY-MM-DD` day key of the shared timeline. */
  selectedDay: string;
  /** Absolute recording timestamp of the shared clock, in epoch ms. */
  sharedTimestampMs: number;
  isPlaying: boolean;
  rate: PlaybackRate;
  /** Slot allowed to emit audio; all other tiles stay muted. Null mutes all. */
  audioSlot: number | null;
  setSlot: (slot: number, path: string | null) => void;
  clearSlot: (slot: number) => void;
  setLayout: (layout: PlaybackLayout) => void;
  setSelectedDay: (dayKey: string) => void;
  setEndpointOverride: (serverUrl: string, baseUrl: string | null) => void;
  setSharedTimestamp: (epochMs: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setRate: (rate: PlaybackRate) => void;
  setAudioSlot: (slot: number | null) => void;
}

interface PlaybackPreferences {
  layout: PlaybackLayout;
  slots: Array<[number, string]>;
  endpointOverrides: Record<string, string>;
}

export const PLAYBACK_SYNC_PREFERENCES_STORAGE_KEY = 'mediamtx-playback-preferences';

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      // Preferences remain usable in memory when browser storage is unavailable.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // Preferences remain usable in memory when browser storage is unavailable.
    }
  },
};

function isPlaybackLayout(value: unknown): value is PlaybackLayout {
  return value === '1x2' || value === '2x2';
}

function isPlaybackRate(value: unknown): value is PlaybackRate {
  return value === 0.5 || value === 1 || value === 2 || value === 4;
}

function restoreSlots(value: unknown): Map<number, string> {
  if (!Array.isArray(value)) return new Map();

  const validEntries: Array<[number, string]> = [];
  for (const entry of value) {
    if (
      Array.isArray(entry) &&
      entry.length === 2 &&
      Number.isInteger(entry[0]) &&
      entry[0] >= 0 &&
      entry[0] < PLAYBACK_SLOT_COUNT &&
      typeof entry[1] === 'string' &&
      entry[1].trim().length > 0
    ) {
      validEntries.push([entry[0], entry[1]]);
    }
  }
  return new Map(validEntries);
}

function restoreEndpointOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const overrides: Record<string, string> = {};
  for (const [serverUrl, baseUrl] of Object.entries(value)) {
    if (typeof baseUrl === 'string' && baseUrl.trim().length > 0) {
      overrides[serverUrl] = baseUrl;
    }
  }
  return overrides;
}

function mergePlaybackPreferences(
  persistedState: unknown,
  currentState: PlaybackState
): PlaybackState {
  if (!persistedState || typeof persistedState !== 'object') return currentState;

  const persisted = persistedState as Partial<PlaybackPreferences>;
  const dayRange = getDayRangeMs(currentState.selectedDay);
  return {
    ...currentState,
    layout:
      persisted.layout === ('1x1' as unknown)
        ? '1x2'
        : isPlaybackLayout(persisted.layout)
          ? persisted.layout
          : currentState.layout,
    slots: restoreSlots(persisted.slots),
    endpointOverrides: restoreEndpointOverrides(persisted.endpointOverrides),
    sharedTimestampMs: dayRange ? dayRange.startMs : currentState.sharedTimestampMs,
  };
}

export function createPlaybackStore(storage: StateStorage = safeLocalStorage, nowMs = Date.now()) {
  const initialDay = todayDayKey(nowMs);
  const initialDayRange = getDayRangeMs(initialDay);

  return create<PlaybackState>()(
    persist(
      (set) => ({
        slots: new Map(),
        layout: '2x2',
        endpointOverrides: {},
        selectedDay: initialDay,
        sharedTimestampMs: initialDayRange ? initialDayRange.startMs : nowMs,
        isPlaying: false,
        rate: 1,
        audioSlot: null,
        setSlot: (slot, path) =>
          set((state) => {
            if (slot < 0 || slot >= PLAYBACK_SLOT_COUNT) return state;
            const next = new Map(state.slots);
            if (path === null || path.trim().length === 0) {
              next.delete(slot);
            } else {
              next.set(slot, path);
            }
            return { slots: next };
          }),
        clearSlot: (slot) =>
          set((state) => {
            const next = new Map(state.slots);
            next.delete(slot);
            return {
              slots: next,
              audioSlot: state.audioSlot === slot ? null : state.audioSlot,
            };
          }),
        setLayout: (layout) => set({ layout }),
        setSelectedDay: (dayKey) =>
          set((state) => {
            if (state.selectedDay === dayKey) return state;
            const dayRange = getDayRangeMs(dayKey);
            if (!dayRange) return state;
            return { selectedDay: dayKey, sharedTimestampMs: dayRange.startMs, isPlaying: false };
          }),
        setEndpointOverride: (serverUrl, baseUrl) =>
          set((state) => {
            const next = { ...state.endpointOverrides };
            if (baseUrl === null || baseUrl.trim().length === 0) {
              delete next[serverUrl];
            } else {
              next[serverUrl] = baseUrl.trim();
            }
            return { endpointOverrides: next };
          }),
        setSharedTimestamp: (epochMs) => set({ sharedTimestampMs: epochMs }),
        setIsPlaying: (isPlaying) => set({ isPlaying }),
        setRate: (rate) => set({ rate: isPlaybackRate(rate) ? rate : 1 }),
        setAudioSlot: (audioSlot) => set({ audioSlot }),
      }),
      {
        name: PLAYBACK_SYNC_PREFERENCES_STORAGE_KEY,
        storage: createJSONStorage<PlaybackPreferences>(() => storage),
        partialize: (state) => ({
          layout: state.layout,
          slots: Array.from(state.slots.entries()),
          endpointOverrides: state.endpointOverrides,
        }),
        merge: mergePlaybackPreferences,
      }
    )
  );
}

const usePlaybackSyncStore = createPlaybackStore();

export default usePlaybackSyncStore;
