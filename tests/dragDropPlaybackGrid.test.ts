import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { registerRecordingDraggable } from '../src/components/playback/PlaybackRecordingSidebar';
import { registerPlaybackDropTarget } from '../src/components/playback/PlaybackTile';
import {
  assignDroppedRecording,
  createPlaybackAssignmentDragData,
  isPlaybackAssignmentDragData,
} from '../src/components/playback/playbackDragData';
import usePlaybackStore from '../src/store/usePlaybackStore';

const sidebarSource = readFileSync(
  new URL('../src/components/playback/PlaybackRecordingSidebar.tsx', import.meta.url),
  'utf8'
);
const tileSource = readFileSync(
  new URL('../src/components/playback/PlaybackTile.tsx', import.meta.url),
  'utf8'
);

describe('playback assignment drag data', () => {
  test('identifies valid internal data and preserves exact nested recording names', () => {
    const data = createPlaybackAssignmentDragData('building/floor/camera');

    expect(data).toEqual({
      type: 'playback-assignment',
      recordingName: 'building/floor/camera',
    });
    expect(isPlaybackAssignmentDragData(data)).toBe(true);
  });

  test('rejects empty, whitespace-only, malformed, and unrelated data', () => {
    expect(isPlaybackAssignmentDragData(createPlaybackAssignmentDragData(''))).toBe(false);
    expect(isPlaybackAssignmentDragData(createPlaybackAssignmentDragData('   '))).toBe(false);
    expect(isPlaybackAssignmentDragData({ type: 'playback-assignment' })).toBe(false);
    expect(isPlaybackAssignmentDragData({ type: 'file', recordingName: 'camera' })).toBe(false);
    expect(isPlaybackAssignmentDragData({ type: 'stream-assignment', streamName: 'camera' })).toBe(
      false
    );
  });

  test('assigns the exact target slot and replaces an occupied slot', () => {
    const assignments = new Map<number, string | null>([
      [0, 'existing'],
      [1, 'untouched'],
    ]);
    const setSlot = (slot: number, path: string | null) => assignments.set(slot, path);

    expect(
      assignDroppedRecording(createPlaybackAssignmentDragData('nested/new'), 0, setSlot)
    ).toBe(true);
    expect(assignments).toEqual(
      new Map([
        [0, 'nested/new'],
        [1, 'untouched'],
      ])
    );
  });

  test('does not assign malformed or unrelated data', () => {
    const assignments = new Map<number, string | null>([[0, 'existing']]);
    const setSlot = (slot: number, path: string | null) => assignments.set(slot, path);

    expect(
      assignDroppedRecording({ type: 'playback-assignment', recordingName: '' }, 0, setSlot)
    ).toBe(false);
    expect(assignDroppedRecording({ type: 'external', recordingName: 'new' }, 0, setSlot)).toBe(
      false
    );
    expect(assignments).toEqual(new Map([[0, 'existing']]));
  });
});

describe('playback grid drag integration', () => {
  afterEach(() => {
    usePlaybackStore.setState({ slots: new Map() });
  });

  test('wires sidebar draggables and tile drop targets with visual feedback', () => {
    expect(sidebarSource).toContain(
      "from '@atlaskit/pragmatic-drag-and-drop/element/adapter'"
    );
    expect(sidebarSource).toContain('return registerRecordingDraggable({');
    expect(sidebarSource).toContain('recordingName: recording.name');
    expect(sidebarSource).toContain('onDragStart: () => setIsDragging(true)');
    expect(sidebarSource).toContain('styles.draggingRecordingButton');
    expect(sidebarSource).toContain("cursor: 'grab'");

    expect(tileSource).toContain('return registerPlaybackDropTarget({');
    expect(tileSource).toContain('canDrop: ({ source }) => isPlaybackAssignmentDragData(source.data)');
    expect(tileSource).toContain('onDragEnter: () => setIsDraggedOver(true)');
    expect(tileSource).toContain('styles.dragOverTile');
    expect(tileSource).not.toContain('Choose stream');
    expect(tileSource).not.toContain('PlaybackSlotPicker');
  });

  test('registered draggable returns the exact valid recording payload and cleanup', () => {
    let registration: Parameters<typeof draggable>[0] | undefined;
    let cleanupCount = 0;
    const draggingStates: boolean[] = [];
    const cleanup = registerRecordingDraggable(
      {
        element: {} as never,
        recordingName: 'building/floor/camera',
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
      type: 'playback-assignment',
      recordingName: 'building/floor/camera',
    });
    expect(isPlaybackAssignmentDragData(payload ?? {})).toBe(true);

    registration?.onDragStart?.({} as never);
    registration?.onDrop?.({} as never);
    expect(draggingStates).toEqual([true, false]);

    cleanup();
    expect(cleanupCount).toBe(1);
  });

  test('registered valid drop assigns the exact playback-store slot', () => {
    usePlaybackStore.setState({
      slots: new Map([
        [1, 'untouched'],
        [3, 'occupied'],
      ]),
    });
    let registration: Parameters<typeof dropTargetForElements>[0] | undefined;
    let cleanupCount = 0;
    const draggedOverStates: boolean[] = [];
    const cleanup = registerPlaybackDropTarget(
      {
        element: {} as never,
        slot: 3,
        setSlot: usePlaybackStore.getState().setSlot,
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
      data: createPlaybackAssignmentDragData('building/floor/replacement'),
    };

    expect(registration?.canDrop?.({ source } as never)).toBe(true);
    expect(
      registration?.canDrop?.({
        source: { data: { type: 'playback-assignment', recordingName: '' } },
      } as never)
    ).toBe(false);
    expect(
      registration?.canDrop?.({
        source: { data: { type: 'stream-assignment', streamName: 'live-stream' } },
      } as never)
    ).toBe(false);

    registration?.onDragEnter?.({ source } as never);
    registration?.onDragLeave?.({ source } as never);
    expect(draggedOverStates).toEqual([true, false]);

    draggedOverStates.length = 0;
    registration?.onDragEnter?.({ source } as never);
    registration?.onDrop?.({ source } as never);

    expect(draggedOverStates).toEqual([true, false]);
    expect(usePlaybackStore.getState().slots).toEqual(
      new Map([
        [1, 'untouched'],
        [3, 'building/floor/replacement'],
      ])
    );

    cleanup();
    expect(cleanupCount).toBe(1);
  });

  test('sidebar click-to-assign keeps first-free-slot behavior', () => {
    expect(sidebarSource).toContain('if (!isAssigned) onAssign(recording.name)');
    expect(sidebarSource).not.toContain('Assign to slot');
  });
});
