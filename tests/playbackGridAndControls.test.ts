import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import PlaybackGrid from '@src/components/playback/PlaybackGrid';
import PlaybackControls from '@src/components/playback/PlaybackControls';
import { RecordedPlaybackController } from '@src/playback/recordedPlaybackController';
import usePlaybackStore from '@src/store/usePlaybackStore';

let renderer: ReactTestRenderer | undefined;
let controller: RecordedPlaybackController | undefined;

async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

async function renderGrid() {
  await act(async () => {
    renderer = create(createElement(PlaybackGrid, {
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
    renderer = create(createElement(PlaybackControls, { controller: controller! }));
    await flushMicrotasks();
  });
  return renderer!.root;
}

function findButtonByAriaLabel(root: ReactTestInstance, ariaLabel: string) {
  return root.find((node) => node.type === 'button' && node.props['aria-label'] === ariaLabel);
}

beforeEach(() => {
  controller = new RecordedPlaybackController({ initialPositionMs: 0 });
  usePlaybackStore.setState({
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

describe('PlaybackGrid slot management', () => {
  test('renders four empty slots in the 2x2 layout', async () => {
    const root = await renderGrid();

    const tiles = root.findAll((node) => typeof node.props['aria-label'] === 'string'
      && String(node.props['aria-label']).startsWith('Playback slot'));
    expect(tiles).toHaveLength(4);
    expect(root.findAll((node) => node.props['aria-label'] === '2x2 recorded playback grid')).toHaveLength(1);
  });

  test('renders two horizontal slots after switching to the 1x2 layout', async () => {
    usePlaybackStore.getState().setSlot(0, 'cam-a');
    usePlaybackStore.getState().setSlot(2, 'cam-c');
    const root = await renderGrid();

    expect(
      root.findAll((node) => String(node.props['aria-label']).startsWith('Playback slot'))
    ).toHaveLength(4);

    await act(async () => {
      usePlaybackStore.getState().setLayout('1x2');
      await flushMicrotasks();
    });

    const tiles = root.findAll((node) =>
      String(node.props['aria-label']).startsWith('Playback slot')
    );
    expect(tiles).toHaveLength(2);
    expect(root.findAll((node) => node.props['aria-label'] === '1x2 recorded playback grid')).toHaveLength(1);
    // Slot 0 keeps its assignment even while hidden slots are unmounted.
    expect(usePlaybackStore.getState().slots.get(0)).toBe('cam-a');
    expect(usePlaybackStore.getState().slots.get(2)).toBe('cam-c');
  });

  test('removes a slot assignment from the tile overlay', async () => {
    usePlaybackStore.getState().setSlot(1, 'cam-b');
    const root = await renderGrid();

    const removeButton = findButtonByAriaLabel(root, 'Remove tile 2');
    await act(async () => {
      removeButton.props.onClick();
      await flushMicrotasks();
    });

    expect(usePlaybackStore.getState().slots.has(1)).toBe(false);
  });

  test('selects and clears the audio slot from the tile overlay', async () => {
    usePlaybackStore.getState().setSlot(1, 'cam-b');
    const root = await renderGrid();

    const listenButton = findButtonByAriaLabel(root, 'Listen to tile 2');
    await act(async () => {
      listenButton.props.onClick();
      await flushMicrotasks();
    });
    expect(usePlaybackStore.getState().audioSlot).toBe(1);

    const muteButton = findButtonByAriaLabel(root, 'Mute tile 2');
    await act(async () => {
      muteButton.props.onClick();
      await flushMicrotasks();
    });
    expect(usePlaybackStore.getState().audioSlot).toBeNull();
  });
});

describe('PlaybackControls transport actions', () => {
  test('play and pause act on the shared controller and mirror the store', async () => {
    const root = await renderControls();
    const playButton = findButtonByAriaLabel(root, 'Play playback');

    await act(async () => {
      playButton.props.onClick();
      await flushMicrotasks();
    });
    expect(controller!.isPlaying()).toBe(true);
    expect(usePlaybackStore.getState().isPlaying).toBe(true);

    const pauseButton = findButtonByAriaLabel(root, 'Pause playback');
    await act(async () => {
      pauseButton.props.onClick();
      await flushMicrotasks();
    });
    expect(controller!.isPlaying()).toBe(false);
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
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

  test('rate options update the store rate', async () => {
    const root = await renderControls();

    const rateDropdown = root.find(
      (node) => node.props['aria-label'] === 'Playback rate'
    );
    await act(async () => {
      rateDropdown.props.onOptionSelect({}, { optionValue: '4' });
      await flushMicrotasks();
    });
    expect(usePlaybackStore.getState().rate).toBe(4);
  });
});
