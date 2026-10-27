import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { PathItem } from '@src/types/stream';

export type StreamsView = 'table' | 'grid';
export type GridLayout = '1x1' | '2x2' | '3x3' | '4x4';

export interface PlayerState {
  drawerStream: PathItem | null;
  isDrawerOpen: boolean;
  streamsView: StreamsView;
  gridLayout: GridLayout;
  activeGridStreams: Map<number, string>;
  gridPlayerIds: Map<number, number>;
  moveGridStream: (fromSlot: number, toSlot: number, playerId: number) => void;
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
  return value === 'table' || value === 'grid';
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

let nextGridPlayerId = 0;

function mergePlayerPreferences(persistedState: unknown, currentState: PlayerState): PlayerState {
  if (!persistedState || typeof persistedState !== 'object') return currentState;

  const persisted = persistedState as Partial<PlayerPreferences>;
  const activeGridStreams = restoreGridStreams(persisted.activeGridStreams);
  return {
    ...currentState,
    streamsView: isStreamsView(persisted.streamsView)
      ? persisted.streamsView
      : currentState.streamsView,
    gridLayout: isGridLayout(persisted.gridLayout)
      ? persisted.gridLayout
      : currentState.gridLayout,
    activeGridStreams,
    gridPlayerIds: new Map(
      Array.from(activeGridStreams.keys(), (slot) => [slot, nextGridPlayerId++])
    ),
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
        gridPlayerIds: new Map(),
        setDrawerStream: (stream) => set({ drawerStream: stream }),
        setIsDrawerOpen: (open) => set({ isDrawerOpen: open }),
        setStreamsView: (view) => set({ streamsView: view }),
        setGridLayout: (layout) => set({ gridLayout: layout }),
        setGridStream: (slot, streamName) =>
          set((state) => {
            const next = new Map(state.activeGridStreams);
            next.set(slot, streamName);
            const ids = new Map(state.gridPlayerIds);
            if (state.activeGridStreams.get(slot) !== streamName || !ids.has(slot)) {
              ids.set(slot, nextGridPlayerId++);
            }
            return { activeGridStreams: next, gridPlayerIds: ids };
          }),
        clearGridStream: (slot) =>
          set((state) => {
            const next = new Map(state.activeGridStreams);
            next.delete(slot);
            const ids = new Map(state.gridPlayerIds);
            ids.delete(slot);
            return { activeGridStreams: next, gridPlayerIds: ids };
          }),
        moveGridStream: (fromSlot, toSlot, playerId) =>
          set((state) => {
            const columns = Number(state.gridLayout[0]);
            const slotCount = columns * columns;
            const streamName = state.activeGridStreams.get(fromSlot);
            if (
              !Number.isInteger(fromSlot) || !Number.isInteger(toSlot) ||
              fromSlot < 0 || toSlot < 0 || fromSlot >= slotCount || toSlot >= slotCount ||
              fromSlot === toSlot || streamName === undefined ||
              state.gridPlayerIds.get(fromSlot) !== playerId
            ) return state;

            const next = new Map(state.activeGridStreams);
            const ids = new Map(state.gridPlayerIds);
            const displacedStream = next.get(toSlot);
            const displacedId = ids.get(toSlot);
            next.delete(fromSlot);
            ids.delete(fromSlot);
            if (displacedStream !== undefined) {
              const emptySlot = Array.from({ length: slotCount }, (_, slot) => slot)
                .find((slot) => !state.activeGridStreams.has(slot)) ?? fromSlot;
              next.set(emptySlot, displacedStream);
              ids.set(emptySlot, displacedId ?? nextGridPlayerId++);
            }
            next.set(toSlot, streamName);
            ids.set(toSlot, playerId);
            return { activeGridStreams: next, gridPlayerIds: ids };
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
