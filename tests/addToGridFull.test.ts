import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { findEmptyGridSlot, gridSlotCount } from '../src/components/streams/gridSlots';
import usePlayerStore from '../src/store/usePlayerStore';

const streamsPageSource = readFileSync(
  new URL('../src/pages/StreamsPage.tsx', import.meta.url),
  'utf8'
);
const streamTableSource = readFileSync(
  new URL('../src/components/streams/StreamTable.tsx', import.meta.url),
  'utf8'
);
const streamCardSource = readFileSync(
  new URL('../src/components/streams/StreamCard.tsx', import.meta.url),
  'utf8'
);
const gridSlotsSource = readFileSync(
  new URL('../src/components/streams/gridSlots.ts', import.meta.url),
  'utf8'
);

describe('grid slot capacity helpers', () => {
  test('gridSlotCount returns the exact slot count for each layout', () => {
    expect(gridSlotCount('1x1')).toBe(1);
    expect(gridSlotCount('2x2')).toBe(4);
    expect(gridSlotCount('3x3')).toBe(9);
    expect(gridSlotCount('4x4')).toBe(16);
  });

  test('findEmptyGridSlot returns 0 for an empty grid', () => {
    expect(findEmptyGridSlot(4, new Map())).toBe(0);
    expect(findEmptyGridSlot(16, new Map())).toBe(0);
    expect(findEmptyGridSlot(1, new Map())).toBe(0);
  });

  test('findEmptyGridSlot returns the first empty in-range slot for a partially filled grid', () => {
    expect(
      findEmptyGridSlot(
        4,
        new Map([
          [0, 'alpha'],
          [2, 'charlie'],
        ])
      )
    ).toBe(1);
    expect(
      findEmptyGridSlot(
        9,
        new Map([
          [1, 'bravo'],
          [2, 'charlie'],
        ])
      )
    ).toBe(0);
    expect(
      findEmptyGridSlot(
        16,
        new Map([
          [0, 'alpha'],
          [1, 'bravo'],
          [2, 'charlie'],
          [3, 'delta'],
          [4, 'echo'],
          [5, 'foxtrot'],
          [6, 'golf'],
          [7, 'hotel'],
          [9, 'india'],
        ])
      )
    ).toBe(8);
  });

  test('findEmptyGridSlot returns -1 when the grid is full', () => {
    expect(
      findEmptyGridSlot(
        4,
        new Map([
          [0, 'alpha'],
          [1, 'bravo'],
          [2, 'charlie'],
          [3, 'delta'],
        ])
      )
    ).toBe(-1);
    expect(findEmptyGridSlot(1, new Map([[0, 'only']]))).toBe(-1);
    expect(
      findEmptyGridSlot(
        9,
        new Map([
          [0, 'a'],
          [1, 'b'],
          [2, 'c'],
          [3, 'd'],
          [4, 'e'],
          [5, 'f'],
          [6, 'g'],
          [7, 'h'],
          [8, 'i'],
        ])
      )
    ).toBe(-1);
  });

  test('findEmptyGridSlot ignores out-of-range stale entries above slotCount and still finds in-range empty slots', () => {
    expect(
      findEmptyGridSlot(
        4,
        new Map([
          [0, 'alpha'],
          [1, 'bravo'],
          [2, 'charlie'],
          [5, 'stale'],
          [7, 'stale'],
        ])
      )
    ).toBe(3);
    expect(
      findEmptyGridSlot(
        4,
        new Map([
          [0, 'alpha'],
          [1, 'bravo'],
          [2, 'charlie'],
          [3, 'delta'],
          [7, 'stale'],
        ])
      )
    ).toBe(-1);
  });
});

describe('Add to Grid full-grid guard (store-backed decision)', () => {
  afterEach(() => {
    usePlayerStore.setState({ activeGridStreams: new Map(), gridLayout: '2x2' });
  });

  test('a full grid leaves activeGridStreams untouched instead of swapping slot 0', () => {
    const fullGrid = new Map([
      [0, 'alpha'],
      [1, 'bravo'],
      [2, 'charlie'],
      [3, 'delta'],
    ]);
    usePlayerStore.setState({ gridLayout: '2x2', activeGridStreams: new Map(fullGrid) });

    const state = usePlayerStore.getState();
    const targetSlot = findEmptyGridSlot(gridSlotCount(state.gridLayout), state.activeGridStreams);
    expect(targetSlot).toBe(-1);

    if (targetSlot !== -1) state.setGridStream(targetSlot, 'echo');

    const result = usePlayerStore.getState().activeGridStreams;
    expect(result).toEqual(fullGrid);
    expect(result.get(0)).toBe('alpha');
    expect([...result.values()]).not.toContain('echo');
  });

  test('a partially filled grid places the next stream in the first empty slot', () => {
    usePlayerStore.setState({
      gridLayout: '2x2',
      activeGridStreams: new Map([
        [0, 'alpha'],
        [2, 'charlie'],
      ]),
    });

    const state = usePlayerStore.getState();
    const targetSlot = findEmptyGridSlot(gridSlotCount(state.gridLayout), state.activeGridStreams);
    expect(targetSlot).toBe(1);

    if (targetSlot !== -1) state.setGridStream(targetSlot, 'bravo');

    expect(usePlayerStore.getState().activeGridStreams).toEqual(
      new Map([
        [0, 'alpha'],
        [1, 'bravo'],
        [2, 'charlie'],
      ])
    );
  });

  test('a grid with only stale out-of-range entries still accepts a new in-range stream', () => {
    usePlayerStore.setState({
      gridLayout: '2x2',
      activeGridStreams: new Map([
        [4, 'stale-one'],
        [5, 'stale-two'],
      ]),
    });

    const state = usePlayerStore.getState();
    const targetSlot = findEmptyGridSlot(gridSlotCount(state.gridLayout), state.activeGridStreams);
    expect(targetSlot).toBe(0);

    if (targetSlot !== -1) state.setGridStream(targetSlot, 'alpha');

    expect(usePlayerStore.getState().activeGridStreams).toEqual(
      new Map([
        [0, 'alpha'],
        [4, 'stale-one'],
        [5, 'stale-two'],
      ])
    );
  });

  test('an explicit slot replacement (drag-and-drop path) still overwrites the chosen slot', () => {
    usePlayerStore.setState({
      gridLayout: '2x2',
      activeGridStreams: new Map([
        [0, 'alpha'],
        [1, 'bravo'],
      ]),
    });

    usePlayerStore.getState().setGridStream(0, 'override');

    expect(usePlayerStore.getState().activeGridStreams).toEqual(
      new Map([
        [0, 'override'],
        [1, 'bravo'],
      ])
    );
  });
});

describe('Add to Grid wiring (source contract)', () => {
  test('handleAddToGrid guards a full grid instead of falling through to slot 0', () => {
    expect(streamsPageSource).toContain('function handleAddToGrid(stream: PathItem)');
    expect(streamsPageSource).toContain(
      'const targetSlot = findEmptyGridSlot(slotCount, activeGridStreams)'
    );
    expect(streamsPageSource).toContain('if (targetSlot === -1) return;');
    expect(streamsPageSource).not.toContain('let targetSlot = 0;');
    expect(streamsPageSource).not.toContain('let targetSlot = 0');
  });

  test('StreamsPage imports the gridSlots helpers and derives isGridFull from the current layout', () => {
    expect(streamsPageSource).toMatch(/from ['"]@src\/components\/streams\/gridSlots['"];/);
    expect(streamsPageSource).toContain('const slotCount = gridSlotCount(gridLayout);');
    expect(streamsPageSource).toContain(
      'const isGridFull = findEmptyGridSlot(slotCount, activeGridStreams) === -1;'
    );
    expect(streamsPageSource.match(/isGridFull=\{isGridFull\}/g)).toHaveLength(2);
  });

  test('StreamTable disables its Add to Grid button when the grid is full and keeps it wired', () => {
    expect(streamTableSource).toContain('isGridFull?: boolean;');
    expect(streamTableSource).toContain('disabled={isGridFull}');
    expect(streamTableSource).toContain('aria-label={`Add ${stream.name} to grid`}');
    expect(streamTableSource).toContain('onClick={() => onAddToGrid(stream)}');
  });

  test('StreamCard disables its Grid button when the grid is full and keeps it wired', () => {
    expect(streamCardSource).toContain('isGridFull?: boolean;');
    expect(streamCardSource).toContain('disabled={isGridFull}');
    expect(streamCardSource).toContain('onClick={() => onAddToGrid(stream)}');
  });

  test('gridSlots helper module exposes the loop that finds the first empty slot or -1', () => {
    expect(gridSlotsSource).toContain('export function gridSlotCount(');
    expect(gridSlotsSource).toContain('export function findEmptyGridSlot(');
    expect(gridSlotsSource).toContain('if (!activeGridStreams.has(index)) return index;');
    expect(gridSlotsSource).toContain('return -1;');
  });
});
