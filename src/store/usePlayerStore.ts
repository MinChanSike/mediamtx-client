import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { PathItem } from '@src/types/stream';

export type StreamsView = 'table' | 'cards' | 'grid';
export type GridLayout = '1x1' | '2x2' | '3x3' | '4x4';

export interface PlayerState {
  drawerStream: PathItem | null;
  isDrawerOpen: boolean;
  streamsView: StreamsView;
  gridLayout: GridLayout;
  activeGridStreams: Map<number, string>;
  setDrawerStream: (stream: PathItem | null) => void;
  setIsDrawerOpen: (open: boolean) => void;
  setStreamsView: (view: StreamsView) => void;
  setGridLayout: (layout: GridLayout) => void;
  setGridStream: (slot: number, streamName: string) => void;
  clearGridStream: (slot: number) => void;
}

interface PlayerPreferences {
  streamsView: StreamsView;
  gridLayout: GridLayout;
  activeGridStreams: Array<[number, string]>;
}

export const PLAYER_PREFERENCES_STORAGE_KEY = 'mediamtx-player-preferences';

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

function isStreamsView(value: unknown): value is StreamsView {
  return value === 'table' || value === 'cards' || value === 'grid';
}

function isGridLayout(value: unknown): value is GridLayout {
  return value === '1x1' || value === '2x2' || value === '3x3' || value === '4x4';
}

function restoreGridStreams(value: unknown): Map<number, string> {
  if (!Array.isArray(value)) return new Map();

  const validEntries: Array<[number, string]> = [];
  for (const entry of value) {
    if (
      Array.isArray(entry) &&
      entry.length === 2 &&
      Number.isInteger(entry[0]) &&
      entry[0] >= 0 &&
      typeof entry[1] === 'string' &&
      entry[1].trim().length > 0
    ) {
      validEntries.push([entry[0], entry[1]]);
    }
  }
  return new Map(validEntries);
}

function mergePlayerPreferences(persistedState: unknown, currentState: PlayerState): PlayerState {
  if (!persistedState || typeof persistedState !== 'object') return currentState;

  const persisted = persistedState as Partial<PlayerPreferences>;
  return {
    ...currentState,
    streamsView: isStreamsView(persisted.streamsView)
      ? persisted.streamsView
      : currentState.streamsView,
    gridLayout: isGridLayout(persisted.gridLayout)
      ? persisted.gridLayout
      : currentState.gridLayout,
    activeGridStreams: restoreGridStreams(persisted.activeGridStreams),
  };
}

export function createPlayerStore(storage: StateStorage = safeLocalStorage) {
  return create<PlayerState>()(
    persist(
      (set) => ({
        drawerStream: null,
        isDrawerOpen: false,
        streamsView: 'table',
        gridLayout: '2x2',
        activeGridStreams: new Map(),
        setDrawerStream: (stream) => set({ drawerStream: stream }),
        setIsDrawerOpen: (open) => set({ isDrawerOpen: open }),
        setStreamsView: (view) => set({ streamsView: view }),
        setGridLayout: (layout) => set({ gridLayout: layout }),
        setGridStream: (slot, streamName) =>
          set((state) => {
            const next = new Map(state.activeGridStreams);
            next.set(slot, streamName);
            return { activeGridStreams: next };
          }),
        clearGridStream: (slot) =>
          set((state) => {
            const next = new Map(state.activeGridStreams);
            next.delete(slot);
            return { activeGridStreams: next };
          }),
      }),
      {
        name: PLAYER_PREFERENCES_STORAGE_KEY,
        storage: createJSONStorage<PlayerPreferences>(() => storage),
        partialize: (state) => ({
          streamsView: state.streamsView,
          gridLayout: state.gridLayout,
          activeGridStreams: Array.from(state.activeGridStreams.entries()),
        }),
        merge: mergePlayerPreferences,
      }
    )
  );
}

const usePlayerStore = createPlayerStore();

export default usePlayerStore;
