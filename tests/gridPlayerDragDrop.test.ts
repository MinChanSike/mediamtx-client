import { describe, expect, test } from 'bun:test';
import type { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { registerGridDropTarget, registerGridPlayerDraggable } from '../src/components/streams/MultiPlayerGrid';
import { createGridPlayerDragData, createStreamAssignmentDragData } from '../src/components/streams/streamDragData';
import { createPlayerStore } from '../src/store/usePlayerStore';

describe('grid player header drag and drop', () => {
  test('registers only the supplied drag button and returns current player identity and cleanup', () => {
    const dragButton = {} as HTMLButtonElement;
    let registration: Parameters<typeof draggable>[0] | undefined;
    let cleaned = false;
    const cleanup = registerGridPlayerDraggable({ element: dragButton, slot: 2, playerId: 7, cameraIcon: {} as HTMLElement, streamName: 'Camera A' }, (options) => {
      registration = options;
      return () => { cleaned = true; };
    });
    expect(registration?.element).toBe(dragButton);
    expect(registration?.getInitialData?.({} as never)).toEqual(createGridPlayerDragData(2, 7));
    cleanup();
    expect(cleaned).toBe(true);
  });

  test('custom preview clones camera icon and renders exact camera name as text', () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const originalComputedStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
    const makeElement = () => ({ style: {}, textContent: '', children: [] as unknown[], append(...children: unknown[]) { this.children.push(...children); } });
    const icon = makeElement();
    const cameraIcon = { cloneNode: (deep: boolean) => { expect(deep).toBe(true); return icon; } } as unknown as HTMLElement;
    const container = makeElement();
    let registration: Parameters<typeof draggable>[0] | undefined;
    const nativeSetDragImage = () => {};
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: makeElement } });
    Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: () => ({ color: 'rgb(0, 255, 0)' }) });
    try {
      registerGridPlayerDraggable({ element: {} as HTMLButtonElement, slot: 0, playerId: 1, cameraIcon, streamName: 'camera/<front>&入口' }, (options) => {
        registration = options;
        return () => {};
      }, (options) => {
        expect(options.nativeSetDragImage).toBe(nativeSetDragImage);
        options.render({ container: container as unknown as HTMLElement });
      });
      registration?.onGenerateDragPreview?.({ nativeSetDragImage } as never);
      const preview = container.children[0] as ReturnType<typeof makeElement>;
      expect(preview.children[0]).toBe(icon);
      expect(icon.style).toEqual({ color: 'rgb(0, 255, 0)' });
      expect((preview.children[1] as ReturnType<typeof makeElement>).textContent).toBe('camera/<front>&入口');
      expect(preview.children).toHaveLength(2);
    } finally {
      if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
      else Reflect.deleteProperty(globalThis, 'document');
      if (originalComputedStyle) Object.defineProperty(globalThis, 'getComputedStyle', originalComputedStyle);
      else Reflect.deleteProperty(globalThis, 'getComputedStyle');
    }
  });

  test('attaches drag registration to dedicated button, not header title or close control', async () => {
    const source = await Bun.file('src/components/streams/MultiPlayerGrid.tsx').text();
    expect(source).toContain('const element = dragButtonRef.current;');
    expect(source).toContain('const dragButtonRef = useRef<ElementRef<"button">>(null);');
    expect(source).toContain('<div className={styles.headerTitle}>');
    expect(source).not.toContain('headerRef');
    expect(source).not.toContain('headerDragHandle');
    const buttonStart = source.indexOf('<Button\n              ref={dragButtonRef}');
    const buttonEnd = source.indexOf('/>', source.indexOf('aria-label={`Move ${streamName} to another grid slot`}', buttonStart));
    expect(buttonStart).toBeGreaterThan(-1);
    expect(buttonEnd).toBeGreaterThan(buttonStart);
    expect(source.slice(buttonStart, buttonEnd)).toContain('icon={<Drag24Regular />}');
    expect(source.slice(buttonEnd + 2).trimStart()).toStartWith('<CloseButton');
  });

  test('routes player moves separately from sidebar assignments and clears drop feedback', () => {
    const store = createPlayerStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
    store.getState().setGridStream(0, 'source');
    store.getState().setGridStream(1, 'target');
    const playerId = store.getState().gridPlayerIds.get(0)!;
    let registration: Parameters<typeof dropTargetForElements>[0] | undefined;
    const feedback: boolean[] = [];
    let cleaned = false;
    const cleanup = registerGridDropTarget({
      element: {} as HTMLDivElement,
      slot: 1,
      setGridStream: store.getState().setGridStream,
      moveGridStream: store.getState().moveGridStream,
      setIsDraggedOver: (value) => feedback.push(value),
    }, (options) => {
      registration = options;
      return () => { cleaned = true; };
    });
    const event = (data: Record<string, unknown>) => ({ source: { data } }) as never;
    const move = event(createGridPlayerDragData(0, playerId));
    expect(registration?.canDrop?.(move)).toBe(true);
    expect(registration?.canDrop?.(event(createGridPlayerDragData(1, playerId)))).toBe(false);
    expect(registration?.canDrop?.(event({ type: 'grid-player', fromSlot: -1, playerId }))).toBe(false);
    expect(registration?.canDrop?.(event({ type: 'unrelated' }))).toBe(false);
    registration?.onDragEnter?.(move);
    registration?.onDragLeave?.(move);
    registration?.onDragEnter?.(move);
    registration?.onDrop?.(move);
    expect(feedback).toEqual([true, false, true, false]);
    expect(store.getState().activeGridStreams).toEqual(new Map([[1, 'source'], [2, 'target']]));
    const moved = store.getState();
    registration?.onDrop?.(move);
    expect(store.getState()).toBe(moved);
    registration?.onDrop?.(event({ type: 'unrelated' }));
    expect(store.getState()).toBe(moved);

    const sidebar = event(createStreamAssignmentDragData('new-camera'));
    expect(registration?.canDrop?.(sidebar)).toBe(true);
    registration?.onDrop?.(sidebar);
    expect(store.getState().activeGridStreams).toEqual(new Map([[1, 'new-camera'], [2, 'target']]));
    cleanup();
    expect(cleaned).toBe(true);
  });
});
