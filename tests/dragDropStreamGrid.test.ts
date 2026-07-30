import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
  registerGridDropTarget,
  registerStreamDraggable,
} from '../src/components/streams/MultiPlayerGrid';
import {
  assignDroppedStream,
  createStreamAssignmentDragData,
  isStreamAssignmentDragData,
} from '../src/components/streams/streamDragData';
import usePlayerStore from '../src/store/usePlayerStore';

const multiPlayerGridSource = readFileSync(
  new URL('../src/components/streams/MultiPlayerGrid.tsx', import.meta.url),
  'utf8'
);
const streamsPageSource = readFileSync(
  new URL('../src/pages/StreamsPage.tsx', import.meta.url),
  'utf8'
);
const streamCardSource = readFileSync(
  new URL('../src/components/streams/StreamCard.tsx', import.meta.url),
  'utf8'
);
const streamTableSource = readFileSync(
  new URL('../src/components/streams/StreamTable.tsx', import.meta.url),
  'utf8'
);

function extractStyleBlock(styleName: string) {
  const marker = `  ${styleName}: {`;
  const start = multiPlayerGridSource.indexOf(marker);

  expect(start).toBeGreaterThanOrEqual(0);

  const nextStyle = multiPlayerGridSource.indexOf('\n  },\n  ', start);
  expect(nextStyle).toBeGreaterThan(start);

  return multiPlayerGridSource.slice(start, nextStyle);
}

describe('stream assignment drag data', () => {
  test('identifies valid internal data and preserves exact nested stream names', () => {
    const data = createStreamAssignmentDragData('building/floor/camera');

    expect(data).toEqual({
      type: 'stream-assignment',
      streamName: 'building/floor/camera',
    });
    expect(isStreamAssignmentDragData(data)).toBe(true);
  });

  test('rejects empty, whitespace-only, malformed, and unrelated data', () => {
    expect(isStreamAssignmentDragData(createStreamAssignmentDragData(''))).toBe(false);
    expect(isStreamAssignmentDragData(createStreamAssignmentDragData('   '))).toBe(false);
    expect(isStreamAssignmentDragData({ type: 'stream-assignment' })).toBe(false);
    expect(isStreamAssignmentDragData({ type: 'file', streamName: 'camera' })).toBe(false);
  });

  test('assigns the exact target slot and replaces an occupied slot', () => {
    const assignments = new Map<number, string>([
      [0, 'existing'],
      [1, 'untouched'],
    ]);
    const setGridStream = (slot: number, streamName: string) => assignments.set(slot, streamName);

    expect(
      assignDroppedStream(createStreamAssignmentDragData('nested/new'), 0, setGridStream)
    ).toBe(true);
    expect(assignments).toEqual(
      new Map([
        [0, 'nested/new'],
        [1, 'untouched'],
      ])
    );
  });

  test('does not assign malformed or unrelated data', () => {
    const assignments = new Map<number, string>([[0, 'existing']]);
    const setGridStream = (slot: number, streamName: string) => assignments.set(slot, streamName);

    expect(assignDroppedStream({ type: 'stream-assignment', streamName: '' }, 0, setGridStream)).toBe(
      false
    );
    expect(assignDroppedStream({ type: 'external', streamName: 'new' }, 0, setGridStream)).toBe(
      false
    );
    expect(assignments).toEqual(new Map([[0, 'existing']]));
  });
});

describe('grid integration', () => {
  afterEach(() => {
    usePlayerStore.setState({ activeGridStreams: new Map(), gridLayout: 'single' });
  });

  test('uses supported element adapter registrations with cleanup and visual feedback', () => {
    expect(multiPlayerGridSource).toContain(
      "from '@atlaskit/pragmatic-drag-and-drop/element/adapter'"
    );
    expect(multiPlayerGridSource).toContain('return registerStreamDraggable({');
    expect(multiPlayerGridSource).toContain('streamName: node.stream.name');
    expect(multiPlayerGridSource).toContain('return registerGridDropTarget({');
    expect(multiPlayerGridSource).toContain('slot: index');
    expect(multiPlayerGridSource).toContain('onDragStart: () => setIsDragging(true)');
    expect(multiPlayerGridSource).toContain('onDragEnter: () => setIsDraggedOver(true)');
    expect(multiPlayerGridSource).toContain('styles.draggingStreamButton');
    expect(multiPlayerGridSource).toContain('styles.dragOverCell');
  });

  test('registered draggable returns the exact valid stream payload and cleanup', () => {
    let registration: Parameters<typeof draggable>[0] | undefined;
    let cleanupCount = 0;
    const draggingStates: boolean[] = [];
    const cleanup = registerStreamDraggable(
      {
        element: {} as never,
        streamName: 'building/floor/camera',
        setIsDragging: (isDragging) => draggingStates.push(isDragging),
      },
      (args) => {
        registration = args;
        return () => {
          cleanupCount += 1;
        };
      }
    );

    const payload = registration?.getInitialData?.({} as never);
    expect(payload).toEqual({
      type: 'stream-assignment',
      streamName: 'building/floor/camera',
    });
    expect(isStreamAssignmentDragData(payload ?? {})).toBe(true);

    registration?.onDragStart?.({} as never);
    registration?.onDrop?.({} as never);
    expect(draggingStates).toEqual([true, false]);

    cleanup();
    expect(cleanupCount).toBe(1);
  });

  test('registered valid drop replaces the exact occupied player-store slot', () => {
    usePlayerStore.setState({
      activeGridStreams: new Map([
        [1, 'untouched'],
        [3, 'occupied'],
      ]),
    });
    let registration: Parameters<typeof dropTargetForElements>[0] | undefined;
    let cleanupCount = 0;
    const draggedOverStates: boolean[] = [];
    const cleanup = registerGridDropTarget(
      {
        element: {} as never,
        slot: 3,
        setGridStream: usePlayerStore.getState().setGridStream,
        setIsDraggedOver: (isDraggedOver) => draggedOverStates.push(isDraggedOver),
      },
      (args) => {
        registration = args;
        return () => {
          cleanupCount += 1;
        };
      }
    );
    const source = {
      data: createStreamAssignmentDragData('building/floor/replacement'),
    };

    expect(registration?.canDrop?.({ source } as never)).toBe(true);
    expect(
      registration?.canDrop?.({
        source: { data: { type: 'stream-assignment', streamName: '' } },
      } as never)
    ).toBe(false);
    expect(
      registration?.canDrop?.({
        source: { data: { type: 'external', streamName: 'unrelated' } },
      } as never)
    ).toBe(false);

    registration?.onDragEnter?.({ source } as never);
    registration?.onDragLeave?.({ source } as never);
    expect(draggedOverStates).toEqual([true, false]);

    draggedOverStates.length = 0;
    registration?.onDragEnter?.({ source } as never);
    registration?.onDrop?.({ source } as never);

    expect(draggedOverStates).toEqual([true, false]);
    expect(usePlayerStore.getState().activeGridStreams).toEqual(
      new Map([
        [1, 'untouched'],
        [3, 'building/floor/replacement'],
      ])
    );

    cleanup();
    expect(cleanupCount).toBe(1);
  });

  test('removes active-slot click assignment while preserving branch and clear controls', () => {
    expect(multiPlayerGridSource).not.toContain('activeSlot');
    expect(multiPlayerGridSource).not.toContain('setActiveSlot');
    expect(multiPlayerGridSource).not.toContain('Assign to slot');
    expect(multiPlayerGridSource).toContain('onClick={() => toggleBranch(node.id)}');
    expect(multiPlayerGridSource).toContain('onClick={() => clearGridStream(index)}');
    expect(multiPlayerGridSource).toContain('<VideoPlayer streamName={streamName} fillCell />');
    expect(multiPlayerGridSource).toContain("'4x4': { slotCount: 16, columns: 4 }");
  });

  test('player store assignment and clear behavior remains functional', () => {
    const store = usePlayerStore.getState();
    store.setGridStream(3, 'camera');
    expect(usePlayerStore.getState().activeGridStreams.get(3)).toBe('camera');

    usePlayerStore.getState().clearGridStream(3);
    expect(usePlayerStore.getState().activeGridStreams.has(3)).toBe(false);
  });

  test('table and card quick Add to Grid actions remain wired', () => {
    expect(streamsPageSource.match(/onAddToGrid=\{handleAddToGrid\}/g)).toHaveLength(2);
    expect(streamCardSource).toContain('onClick={() => onAddToGrid(stream)}');
    expect(streamTableSource).toContain('onClick={() => onAddToGrid(stream)}');
  });

  test('grid dividers are owned by the grid instead of full cell borders', () => {
    const gridStyles = extractStyleBlock('grid');
    const cellStyles = extractStyleBlock('cell');

    expect(gridStyles).toContain('gap: tokens.strokeWidthThin');
    expect(gridStyles).toContain('backgroundColor: tokens.colorNeutralStroke3');
    expect(cellStyles).not.toContain('border:');
    expect(cellStyles).not.toContain('borderColor');
    expect(cellStyles).toContain('backgroundColor: tokens.colorNeutralBackground1');
    expect(multiPlayerGridSource).toContain(
      'border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`'
    );
    expect(multiPlayerGridSource).toContain(
      'borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`'
    );
    expect(multiPlayerGridSource).toContain(
      'borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`'
    );
  });

  test('cell interaction states use inset rings rather than full borders', () => {
    const cellStyles = extractStyleBlock('cell');
    const dragOverCellStyles = extractStyleBlock('dragOverCell');
    const occupiedCellStyles = extractStyleBlock('occupiedCell');

    expect(cellStyles).toContain("transitionProperty: 'background-color, box-shadow'");
    expect(cellStyles).toContain(
      'boxShadow: `inset 0 0 0 ${tokens.strokeWidthThin} ${tokens.colorNeutralStroke1}`'
    );
    expect(dragOverCellStyles).not.toContain('border:');
    expect(dragOverCellStyles).toContain(
      'boxShadow: `inset 0 0 0 ${tokens.strokeWidthThick} ${tokens.colorBrandStroke1}`'
    );
    expect(occupiedCellStyles).not.toContain('border:');
    expect(occupiedCellStyles).toContain(
      'boxShadow: `inset 0 0 0 ${tokens.strokeWidthThin} ${tokens.colorBrandStroke2Hover}`'
    );
  });
});
