import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import PlaybackSyncGrid from '@src/components/playbackSync/PlaybackSyncGrid';
import PlaybackSyncControls from '@src/components/playbackSync/PlaybackSyncControls';
import { RecordedPlaybackSyncController } from '@src/playbackSync/recordedPlaybackSyncController';
import usePlaybackSyncStore from '@src/store/usePlaybackSyncStore';

let renderer: ReactTestRenderer | undefined;
let controller: RecordedPlaybackSyncController | undefined;

async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

async function renderGrid() {
  await act(async () => {
    renderer = create(createElement(PlaybackSyncGrid, {
      controller: controller!,
      tileSnapshots: {},
      slotSpansStatus: [
        { error: null, isLoading: false },
        { error: null, isLoading: false },
        { error: null, isLoading: false },
        { error: null, isLoading: false },
      ],
    }));
    await flushMicrotasks();
  });
  return renderer!.root;
}

async function renderControls() {
  await act(async () => {
    renderer = create(createElement(PlaybackSyncControls, { controller: controller! }));
    await flushMicrotasks();
  });
  return renderer!.root;
}

function findButtonByAriaLabel(root: ReactTestInstance, ariaLabel: string) {
  return root.find((node) => node.type === 'button' && node.props['aria-label'] === ariaLabel);
}

beforeEach(() => {
  controller = new RecordedPlaybackSyncController({ initialPositionMs: 0 });
  usePlaybackSyncStore.setState({
    slots: new Map(),
    layout: '2x2',
    endpointOverrides: {},
    selectedDay: '2026-01-02',
    sharedTimestampMs: 0,
    isPlaying: false,
    rate: 1,
    audioSlot: null,
  });
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
    renderer = undefined;
    controller?.dispose();
    controller = undefined;
    await flushMicrotasks();
  });
});

describe('PlaybackSyncGrid slot management', () => {
  test('renders four empty slots in the 2x2 layout', async () => {
    const root = await renderGrid();

    const tiles = root.findAll((node) => typeof node.props['aria-label'] === 'string'
      && String(node.props['aria-label']).startsWith('Playback slot'));
    expect(tiles).toHaveLength(4);
    expect(root.findAll((node) => node.props['aria-label'] === '2x2 recorded playback grid')).toHaveLength(1);
  });

  test('renders two horizontal slots after switching to the 1x2 layout', async () => {
    usePlaybackSyncStore.getState().setSlot(0, 'cam-a');
    usePlaybackSyncStore.getState().setSlot(2, 'cam-c');
    const root = await renderGrid();

    expect(
      root.findAll((node) => String(node.props['aria-label']).startsWith('Playback slot'))
    ).toHaveLength(4);

    await act(async () => {
      usePlaybackSyncStore.getState().setLayout('1x2');
      await flushMicrotasks();
    });

    const tiles = root.findAll((node) =>
      String(node.props['aria-label']).startsWith('Playback slot')
    );
    expect(tiles).toHaveLength(2);
    expect(root.findAll((node) => node.props['aria-label'] === '1x2 recorded playback grid')).toHaveLength(1);
    // Slot 0 keeps its assignment even while hidden slots are unmounted.
    expect(usePlaybackSyncStore.getState().slots.get(0)).toBe('cam-a');
    expect(usePlaybackSyncStore.getState().slots.get(2)).toBe('cam-c');
  });

  test('removes a slot assignment from the tile overlay', async () => {
    usePlaybackSyncStore.getState().setSlot(1, 'cam-b');
    const root = await renderGrid();

    const removeButton = findButtonByAriaLabel(root, 'Remove tile 2');
    await act(async () => {
      removeButton.props.onClick();
      await flushMicrotasks();
    });

    expect(usePlaybackSyncStore.getState().slots.has(1)).toBe(false);
  });

  test('selects and clears the audio slot from the tile overlay', async () => {
    usePlaybackSyncStore.getState().setSlot(1, 'cam-b');
    const root = await renderGrid();

    const listenButton = findButtonByAriaLabel(root, 'Listen to tile 2');
    await act(async () => {
      listenButton.props.onClick();
      await flushMicrotasks();
    });
    expect(usePlaybackSyncStore.getState().audioSlot).toBe(1);

    const muteButton = findButtonByAriaLabel(root, 'Mute tile 2');
    await act(async () => {
      muteButton.props.onClick();
      await flushMicrotasks();
    });
    expect(usePlaybackSyncStore.getState().audioSlot).toBeNull();
  });
});

describe('PlaybackSyncControls transport actions', () => {
  test('play and pause act on the shared controller and mirror the store', async () => {
    const root = await renderControls();
    const playButton = findButtonByAriaLabel(root, 'Play playback');

    await act(async () => {
      playButton.props.onClick();
      await flushMicrotasks();
    });
    expect(controller!.isPlaying()).toBe(true);
    expect(usePlaybackSyncStore.getState().isPlaying).toBe(true);

    const pauseButton = findButtonByAriaLabel(root, 'Pause playback');
    await act(async () => {
      pauseButton.props.onClick();
      await flushMicrotasks();
    });
    expect(controller!.isPlaying()).toBe(false);
    expect(usePlaybackSyncStore.getState().isPlaying).toBe(false);
  });

  test('seek buttons nudge the shared clock by ten seconds', async () => {
    const root = await renderControls();

    await act(async () => {
      findButtonByAriaLabel(root, 'Seek forward 10 seconds').props.onClick();
      await flushMicrotasks();
    });
    expect(controller!.getPositionMs()).toBe(10_000);

    await act(async () => {
      findButtonByAriaLabel(root, 'Seek back 10 seconds').props.onClick();
      await flushMicrotasks();
    });
    expect(controller!.getPositionMs()).toBe(0);
  });

  test('rate buttons update the store rate', async () => {
    const root = await renderControls();

    const rateButton = root.find(
      (node) => node.type === 'button' && node.props['aria-label'] === 'Set playback rate 4x'
    );
    await act(async () => {
      rateButton.props.onClick();
      await flushMicrotasks();
    });
    expect(usePlaybackSyncStore.getState().rate).toBe(4);
  });
});
