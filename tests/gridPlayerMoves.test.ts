import { describe, expect, test } from 'bun:test';
import type { StateStorage } from 'zustand/middleware';
import {
  createPlayerStore,
  PLAYER_PREFERENCES_STORAGE_KEY,
  type GridLayout,
  type PlayerState,
} from '../src/store/usePlayerStore';
import {
  createGridPlayerDragData,
  createStreamAssignmentDragData,
  isGridPlayerDragData,
  isStreamAssignmentDragData,
} from '../src/components/streams/streamDragData';

function memoryStorage(initial?: unknown) {
  const values = new Map<string, string>();
  if (initial !== undefined) {
    values.set(PLAYER_PREFERENCES_STORAGE_KEY, JSON.stringify({ state: initial, version: 0 }));
  }
  const storage: StateStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  return { storage, values };
}

type Store = ReturnType<typeof createPlayerStore>;
const layouts: Array<[GridLayout, number]> = [
  ['1x1', 1], ['2x2', 4], ['3x3', 9], ['4x4', 16],
];

function makeStore(entries: Array<[number, string]> = [], layout: GridLayout = '2x2') {
  const store = createPlayerStore(memoryStorage().storage);
  store.getState().setGridLayout(layout);
  for (const [slot, name] of entries) store.getState().setGridStream(slot, name);
  return store;
}

function playerId(store: Store, slot: number): number {
  const id = store.getState().gridPlayerIds.get(slot);
  if (id === undefined) throw new Error(`Missing player ID at slot ${slot}`);
  return id;
}

function expectValidIds(state: PlayerState) {
  expect([...state.gridPlayerIds.keys()].sort((a, b) => a - b))
    .toEqual([...state.activeGridStreams.keys()].sort((a, b) => a - b));
  const ids = [...state.gridPlayerIds.values()];
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThanOrEqual(0);
  }
}

function expectNoop(store: Store, from: number, to: number, id: number) {
  const before = store.getState();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  try {
    before.moveGridStream(from, to, id);
    expect(store.getState()).toBe(before);
    expect(store.getState().activeGridStreams).toBe(before.activeGridStreams);
    expect(store.getState().gridPlayerIds).toBe(before.gridPlayerIds);
    expect(notifications).toBe(0);
  } finally {
    unsubscribe();
  }
}

describe('grid player identity and moves', () => {
  test('moves to empty slot without recreating player or mutating previous maps', () => {
    const store = makeStore([[0, 'building/floor/camera'], [2, 'other']]);
    const before = store.getState();
    const id = playerId(store, 0);
    const otherId = playerId(store, 2);
    before.moveGridStream(0, 3, id);
    const after = store.getState();
    expect(after.activeGridStreams).toEqual(new Map([[3, 'building/floor/camera'], [2, 'other']]));
    expect(after.gridPlayerIds).toEqual(new Map([[3, id], [2, otherId]]));
    expect(before.activeGridStreams).toEqual(new Map([[0, 'building/floor/camera'], [2, 'other']]));
    expect(before.gridPlayerIds).toEqual(new Map([[0, id], [2, otherId]]));
    expect(after.activeGridStreams).not.toBe(before.activeGridStreams);
    expect(after.gridPlayerIds).not.toBe(before.gridPlayerIds);
  });

  test('displaces occupied target into first previously empty visible slot, not freed source', () => {
    // Source 0 becomes empty, but slot 2 was already empty before this move.
    const store = makeStore([[0, 'source'], [1, 'target'], [8, 'hidden']]);
    const sourceId = playerId(store, 0);
    const targetId = playerId(store, 1);
    const hiddenId = playerId(store, 8);
    store.getState().moveGridStream(0, 1, sourceId);
    expect(store.getState().activeGridStreams).toEqual(new Map([
      [1, 'source'], [2, 'target'], [8, 'hidden'],
    ]));
    expect(store.getState().gridPlayerIds).toEqual(new Map([
      [1, sourceId], [2, targetId], [8, hiddenId],
    ]));
  });

  test('full visible grid swaps target into freed source even with empty hidden slots', () => {
    const store = makeStore([[0, 'a'], [1, 'b'], [2, 'c'], [3, 'd'], [9, 'hidden']]);
    const before = store.getState();
    const ids = new Map(before.gridPlayerIds);
    before.moveGridStream(2, 0, playerId(store, 2));
    expect(store.getState().activeGridStreams).toEqual(new Map([
      [0, 'c'], [1, 'b'], [2, 'a'], [3, 'd'], [9, 'hidden'],
    ]));
    expect(store.getState().gridPlayerIds).toEqual(new Map([
      [0, ids.get(2)!], [1, ids.get(1)!], [2, ids.get(0)!], [3, ids.get(3)!], [9, ids.get(9)!],
    ]));
  });

  test('same slot and empty source are noops', () => {
    const store = makeStore([[0, 'camera']]);
    expectNoop(store, 0, 0, playerId(store, 0));
    expectNoop(store, 1, 2, playerId(store, 0));
    expectNoop(makeStore(), 0, 1, 0);
  });

  for (const invalid of [-1, 4, 16, 0.5, NaN, Infinity, -Infinity]) {
    test(`rejects invalid source and target slot ${String(invalid)}`, () => {
      const store = makeStore([[0, 'camera'], [4, 'hidden']]);
      expectNoop(store, invalid, 1, playerId(store, 0));
      expectNoop(store, 0, invalid, playerId(store, 0));
    });
  }

  test('rejects wrong, malformed and stale player IDs', () => {
    const store = makeStore([[0, 'camera'], [1, 'other']]);
    for (const id of [playerId(store, 1), -1, 0.5, NaN, Infinity]) {
      expectNoop(store, 0, 2, id);
    }
    const oldId = playerId(store, 0);
    store.getState().setGridStream(0, 'replacement');
    expect(playerId(store, 0)).not.toBe(oldId);
    expectNoop(store, 0, 2, oldId);
    const replacementId = playerId(store, 0);
    store.getState().clearGridStream(0);
    expectNoop(store, 0, 2, replacementId);
    store.getState().setGridStream(0, 'replacement');
    expect(playerId(store, 0)).not.toBe(replacementId);
    expectNoop(store, 0, 2, replacementId);
  });

  test('previous drag payload cannot move another player after source gets refilled', () => {
    const store = makeStore([[0, 'same'], [1, 'same'], [2, 'c'], [3, 'd']]);
    const payload = createGridPlayerDragData(0, playerId(store, 0));
    store.getState().moveGridStream(payload.fromSlot, 1, payload.playerId);
    expectNoop(store, payload.fromSlot, 2, payload.playerId);
  });

  test('duplicate streams keep distinct identities through displacement, swap and clear', () => {
    const store = makeStore([[0, 'same'], [1, 'same'], [3, 'third']]);
    const first = playerId(store, 0);
    const second = playerId(store, 1);
    expect(first).not.toBe(second);
    store.getState().setGridStream(0, 'same');
    expect(playerId(store, 0)).toBe(first);
    store.getState().moveGridStream(0, 1, first);
    expect(playerId(store, 1)).toBe(first);
    expect(playerId(store, 2)).toBe(second);
    store.getState().setGridStream(0, 'fourth');
    store.getState().moveGridStream(1, 2, first);
    expect(playerId(store, 2)).toBe(first);
    expect(playerId(store, 1)).toBe(second);
    store.getState().clearGridStream(1);
    expect(store.getState().gridPlayerIds.has(1)).toBe(false);
    expect(playerId(store, 2)).toBe(first);
    expectValidIds(store.getState());
  });

  for (const [layout, count] of layouts) {
    test(`${layout} uses visible bounds and leaves layout, view, drawer and hidden players unchanged`, () => {
      const entries: Array<[number, string]> = Array.from({ length: count }, (_, slot) => [slot, `camera-${slot}`]);
      entries.push([count, 'hidden-first'], [30, 'hidden-last']);
      const store = makeStore(entries, layout);
      store.getState().setStreamsView('grid');
      store.getState().setIsDrawerOpen(true);
      const before = store.getState();
      const id = playerId(store, 0);
      expectNoop(store, count, 0, playerId(store, count));
      expectNoop(store, 0, count, id);
      if (count === 1) expectNoop(store, 0, 0, id);
      else {
        before.moveGridStream(0, count - 1, id);
        expect(playerId(store, count - 1)).toBe(id);
        expect(playerId(store, 0)).toBe(before.gridPlayerIds.get(count - 1)!);
      }
      const after = store.getState();
      expect(after.gridLayout).toBe(layout);
      expect(after.streamsView).toBe('grid');
      expect(after.isDrawerOpen).toBe(true);
      expect(after.drawerStream).toBe(before.drawerStream);
      for (const slot of [count, 30]) {
        expect(after.activeGridStreams.get(slot)).toBe(before.activeGridStreams.get(slot));
        expect(after.gridPlayerIds.get(slot)).toBe(before.gridPlayerIds.get(slot));
      }
      expectValidIds(after);
    });
  }

  test('shrinking and expanding layout never removes or recreates hidden assignments', () => {
    const store = makeStore([[0, 'a'], [3, 'b'], [8, 'c'], [15, 'd'], [25, 'e']], '4x4');
    const before = store.getState();
    for (const [layout] of layouts) {
      store.getState().setGridLayout(layout);
      expect(store.getState().activeGridStreams).toBe(before.activeGridStreams);
      expect(store.getState().gridPlayerIds).toBe(before.gridPlayerIds);
    }
  });
});

// Independent slot-array oracle: choose displacement destination before moving.
function checkMoveAgainstModel(store: Store, from: number, to: number, count: number) {
  const before = store.getState();
  const slots = Array.from({ length: count }, (_, slot) => {
    const name = before.activeGridStreams.get(slot);
    return name === undefined ? undefined : { name, id: playerId(store, slot) };
  });
  const moving = slots[from];
  const id = moving?.id ?? -1;
  if (!moving || from === to) {
    expectNoop(store, from, to, id);
    return;
  }
  const target = slots[to];
  const firstEmpty = slots.findIndex((value) => value === undefined);
  slots[from] = undefined;
  if (target) slots[firstEmpty === -1 ? from : firstEmpty] = target;
  slots[to] = moving;
  before.moveGridStream(from, to, id);
  const after = store.getState();
  const expectedStreams = new Map(before.activeGridStreams);
  const expectedIds = new Map(before.gridPlayerIds);
  for (let slot = 0; slot < count; slot += 1) {
    const expected = slots[slot];
    if (expected) {
      expectedStreams.set(slot, expected.name);
      expectedIds.set(slot, expected.id);
    } else {
      expectedStreams.delete(slot);
      expectedIds.delete(slot);
    }
  }
  expect(after.activeGridStreams).toEqual(expectedStreams);
  expect(after.gridPlayerIds).toEqual(expectedIds);
  expect([...after.gridPlayerIds.values()].sort((a, b) => a - b))
    .toEqual([...before.gridPlayerIds.values()].sort((a, b) => a - b));
  expectValidIds(after);
}

describe('grid move invariants', () => {
  test('exhausts all 2x2 occupancy masks and source/target pairs', () => {
    for (let mask = 0; mask < 16; mask += 1) {
      for (let from = 0; from < 4; from += 1) {
        for (let to = 0; to < 4; to += 1) {
          const entries: Array<[number, string]> = [[8, 'hidden']];
          for (let slot = 0; slot < 4; slot += 1) {
            if (mask & (1 << slot)) entries.push([slot, 'duplicate']);
          }
          checkMoveAgainstModel(makeStore(entries), from, to, 4);
        }
      }
    }
  });

  for (const [layout, count] of layouts) {
    test(`${layout} preserves players through seeded move sequences at every occupancy`, () => {
      let seed = 0x5eed;
      const randomSlot = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return Math.floor((seed / 0x100000000) * count);
      };
      for (let occupied = 0; occupied <= count; occupied += 1) {
        const entries: Array<[number, string]> = [[count, 'hidden'], [40, 'hidden-duplicate']];
        for (let slot = 0; slot < occupied; slot += 1) entries.push([slot, `camera-${slot % 2}`]);
        const store = makeStore(entries, layout);
        for (let step = 0; step < 64; step += 1) {
          checkMoveAgainstModel(store, randomSlot(), randomSlot(), count);
        }
      }
    });
  }
});

describe('grid-player drag data guard', () => {
  test('creates exact payload and accepts zero-valued slot and player ID', () => {
    const data = createGridPlayerDragData(0, 0);
    expect(data).toEqual({ type: 'grid-player', fromSlot: 0, playerId: 0 });
    expect(isGridPlayerDragData(data)).toBe(true);
    expect(isStreamAssignmentDragData(data)).toBe(false);
    expect(isGridPlayerDragData({ ...createGridPlayerDragData(15, 123), extra: true })).toBe(true);
    // Layout bounds and current ownership belong to store, not structural guard.
    expect(isGridPlayerDragData(createGridPlayerDragData(100, 123))).toBe(true);
  });

  test('rejects missing fields, wrong discriminator and stream-assignment payloads', () => {
    const invalid: Array<Record<string, unknown>> = [
      {}, { type: 'grid-player' }, { type: 'grid-player', fromSlot: 0 },
      { type: 'grid-player', playerId: 0 }, { fromSlot: 0, playerId: 0 },
      { type: 'other', fromSlot: 0, playerId: 0 },
      createStreamAssignmentDragData('camera'),
      { ...createStreamAssignmentDragData('camera'), fromSlot: 0, playerId: 0 },
    ];
    for (const data of invalid) expect(isGridPlayerDragData(data)).toBe(false);
  });

  test('rejects non-integer, negative and non-number fields independently', () => {
    for (const value of [-1, 0.5, NaN, Infinity, -Infinity, '0', null, undefined, true, {}, []]) {
      expect(isGridPlayerDragData({ type: 'grid-player', fromSlot: value, playerId: 0 })).toBe(false);
      expect(isGridPlayerDragData({ type: 'grid-player', fromSlot: 0, playerId: value })).toBe(false);
    }
  });
});

describe('grid player persistence', () => {
  test('old storage without player IDs rehydrates valid distinct IDs, including hidden duplicates', async () => {
    const entries: Array<[number, string]> = [[0, 'same'], [1, 'same'], [15, 'hidden']];
    const { storage } = memoryStorage({ streamsView: 'grid', gridLayout: '2x2', activeGridStreams: entries });
    const store = createPlayerStore(storage);
    await store.persist.rehydrate();
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().activeGridStreams).toEqual(new Map(entries));
    expect(store.getState().streamsView).toBe('grid');
    expect(store.getState().gridLayout).toBe('2x2');
    expectValidIds(store.getState());
    const sourceId = playerId(store, 0);
    const targetId = playerId(store, 1);
    const hiddenId = playerId(store, 15);
    store.getState().moveGridStream(0, 1, sourceId);
    expect(store.getState().gridPlayerIds).toEqual(new Map([[1, sourceId], [2, targetId], [15, hiddenId]]));
  });

  test('persists moved assignments, not transient IDs; reload creates fresh IDs and rejects old payload', async () => {
    const { storage, values } = memoryStorage();
    const store = createPlayerStore(storage);
    store.getState().setStreamsView('grid');
    store.getState().setGridLayout('3x3');
    for (const [slot, name] of [[0, 'same'], [1, 'same'], [8, 'last'], [20, 'hidden']] as const) {
      store.getState().setGridStream(slot, name);
    }
    store.getState().moveGridStream(0, 1, playerId(store, 0));
    store.getState().moveGridStream(8, 0, playerId(store, 8));
    const moved = store.getState();
    const saved = JSON.parse(values.get(PLAYER_PREFERENCES_STORAGE_KEY)!);
    expect(saved.version).toBe(0);
    expect(saved.state).toEqual({
      streamsView: 'grid', gridLayout: '3x3',
      activeGridStreams: [...moved.activeGridStreams.entries()],
    });
    expect(saved.state.gridPlayerIds).toBeUndefined();
    const oldIds = new Set(moved.gridPlayerIds.values());
    const reloaded = createPlayerStore(storage);
    await reloaded.persist.rehydrate();
    expect(reloaded.getState().activeGridStreams).toEqual(moved.activeGridStreams);
    expect(reloaded.getState().gridLayout).toBe('3x3');
    expect(reloaded.getState().streamsView).toBe('grid');
    expectValidIds(reloaded.getState());
    for (const id of reloaded.getState().gridPlayerIds.values()) expect(oldIds.has(id)).toBe(false);
    expectNoop(reloaded, 1, 3, playerId(store, 1));
    const freshId = playerId(reloaded, 1);
    reloaded.getState().moveGridStream(1, 3, freshId);
    expect(playerId(reloaded, 3)).toBe(freshId);
    const thirdStore = createPlayerStore(storage);
    expect(thirdStore.getState().activeGridStreams).toEqual(reloaded.getState().activeGridStreams);
    expectValidIds(thirdStore.getState());
  });

  test('rehydrated IDs correspond only to valid legacy assignments', () => {
    const { storage } = memoryStorage({
      streamsView: 'grid', gridLayout: '4x4',
      activeGridStreams: [[0, 'old'], [0, 'latest'], [3, 'same'], [16, 'same'],
        [-1, 'negative'], [1.5, 'fraction'], ['2', 'string slot'], [4, ''], [5, '   '], [6, null], [7]],
    });
    const store = createPlayerStore(storage);
    expect(store.getState().activeGridStreams).toEqual(new Map([[0, 'latest'], [3, 'same'], [16, 'same']]));
    expectValidIds(store.getState());
  });
});
