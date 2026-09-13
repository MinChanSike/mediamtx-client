import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type PlaybackRate = 0.5 | 1 | 2 | 4;

export const PLAYBACK_RATES: readonly PlaybackRate[] = [0.5, 1, 2, 4] as const;

export interface PlaybackState {
  /** Advance to the next recorded file automatically when one finishes. */
  autoplayEnabled: boolean;
  rate: PlaybackRate;
  setAutoplayEnabled: (enabled: boolean) => void;
  setRate: (rate: PlaybackRate) => void;
}

interface PlaybackPreferences {
  autoplayEnabled: boolean;
  rate: PlaybackRate;
}

export const PLAYBACK_PREFERENCES_STORAGE_KEY = 'mediamtx-playback-file-preferences';

function isPlaybackRate(value: unknown): value is PlaybackRate {
  return value === 0.5 || value === 1 || value === 2 || value === 4;
}

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
      // Ignore closed storage.
    }
  },
};

function mergePlaybackPreferences(
  persistedState: unknown,
  currentState: PlaybackState
): PlaybackState {
  if (!persistedState || typeof persistedState !== 'object') return currentState;

  const persisted = persistedState as Partial<PlaybackPreferences>;
  return {
    ...currentState,
    autoplayEnabled:
      typeof persisted.autoplayEnabled === 'boolean'
        ? persisted.autoplayEnabled
        : currentState.autoplayEnabled,
    rate: isPlaybackRate(persisted.rate) ? persisted.rate : currentState.rate,
  };
}

export function createPlaybackStore(storage: StateStorage = safeLocalStorage) {
  return create<PlaybackState>()(
    persist(
      (set) => ({
        autoplayEnabled: false,
        rate: 1,
        setAutoplayEnabled: (autoplayEnabled) => set({ autoplayEnabled }),
        setRate: (rate) => set({ rate: isPlaybackRate(rate) ? rate : 1 }),
      }),
      {
        name: PLAYBACK_PREFERENCES_STORAGE_KEY,
        storage: createJSONStorage<PlaybackPreferences>(() => storage),
        partialize: (state) => ({ autoplayEnabled: state.autoplayEnabled, rate: state.rate }),
        merge: mergePlaybackPreferences,
      }
    )
  );
}

const usePlaybackStore = createPlaybackStore();

export default usePlaybackStore;
