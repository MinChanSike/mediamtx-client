import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useStreamPlayer } from '../src/hooks/useStreamPlayer';
import MultiPlayerGrid from '../src/components/streams/MultiPlayerGrid';
import VideoPlayer from '../src/components/streams/VideoPlayer';
import usePlayerStore from '../src/store/usePlayerStore';
import useAppStore from '../src/store/useAppStore';
import useMediaMTXApiStore from '../src/store/useMediaMTXApiStore';
import type { GlobalConfig } from '../src/types/config';

const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalRTCPeerConnection = globalThis.RTCPeerConnection;
const originalRTCSessionDescription = globalThis.RTCSessionDescription;

type PlayerResult = ReturnType<typeof useStreamPlayer>;

let renderer: ReactTestRenderer | undefined;
let currentPlayer: PlayerResult | undefined;
let currentApiConfig: GlobalConfig;
let connectionStarts = 0;
let connectionCloses = 0;
let fetchUrls: string[] = [];

function makeGlobalConfig(overrides: Partial<GlobalConfig> = {}): GlobalConfig {
  return {
    logLevel: 'info',
    logDestinations: ['stdout'],
    logFile: 'mediamtx.log',
    readTimeout: '10s',
    writeTimeout: '10s',
    readBufferCount: 512,
    udpMaxPayloadSize: 1472,
    apiAddress: '127.0.0.1:9997',
    metricsAddress: '127.0.0.1:9998',
    hlsAddress: ':8888',
    rtspAddress: ':8554',
    rtmpAddress: ':1935',
    webrtcAddress: ':8889',
    paths: {},
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function restoreWindow() {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

async function flushAsyncWork() {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
}

class MockRTCPeerConnection {
  connectionState = 'new';
  ontrack: RTCPeerConnection['ontrack'] = null;
  onconnectionstatechange: RTCPeerConnection['onconnectionstatechange'] = null;

  constructor() {
    connectionStarts += 1;
  }

  addTransceiver() {
    return {};
  }

  async createOffer() {
    return { type: 'offer' as const, sdp: 'offer-sdp' };
  }

  async setLocalDescription() {
    return undefined;
  }

  async setRemoteDescription() {
    return undefined;
  }

  close() {
    connectionCloses += 1;
  }
}

class MockRTCSessionDescription {
  constructor(public description: RTCSessionDescriptionInit) {}
}

function installBrowserPlaybackMocks() {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
  });
  globalThis.RTCPeerConnection =
    MockRTCPeerConnection as unknown as typeof RTCPeerConnection;
  globalThis.RTCSessionDescription =
    MockRTCSessionDescription as unknown as typeof RTCSessionDescription;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    fetchUrls.push(url);

    if (url.endsWith('/v3/config/global/get')) {
      return jsonResponse(currentApiConfig);
    }

    return new Response('answer-sdp', {
      status: 200,
      headers: { 'Content-Type': 'application/sdp' },
    });
  }) as typeof fetch;
}

function createVideoNodeMock(element: { type: unknown }) {
  if (element.type !== 'video') return {};

  return {
    src: '',
    srcObject: null,
    muted: true,
    volume: 0.5,
    canPlayType: () => '',
    play: () => Promise.resolve(),
    pause: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
}

function PlayerHarness({ streamName }: { streamName: string | null }) {
  currentPlayer = useStreamPlayer(streamName);
  return createElement('video', { ref: currentPlayer.videoRef });
}

async function renderPlayer(streamName: string | null) {
  await act(async () => {
    renderer = create(createElement(PlayerHarness, { streamName }), {
      createNodeMock: createVideoNodeMock,
    });
  });
  await flushAsyncWork();
}

async function updatePlayer(streamName: string | null) {
  await act(async () => {
    renderer?.update(createElement(PlayerHarness, { streamName }));
  });
  await flushAsyncWork();
}

async function replaceConfig(overrides: Partial<GlobalConfig>) {
  currentApiConfig = makeGlobalConfig(overrides);
  await act(async () => {
    useMediaMTXApiStore.getState().setGlobalConfigSuccess(currentApiConfig);
  });
  await flushAsyncWork();
}

beforeEach(() => {
  connectionStarts = 0;
  connectionCloses = 0;
  fetchUrls = [];
  currentPlayer = undefined;
  currentApiConfig = makeGlobalConfig();
  installBrowserPlaybackMocks();
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({ serverUrl: 'http://media.example.test:9997' });
  useMediaMTXApiStore.getState().resetForServerUrl('http://media.example.test:9997');
  useMediaMTXApiStore.getState().setGlobalConfigSuccess(currentApiConfig);
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
    renderer = undefined;
  });
  await flushAsyncWork();
  globalThis.fetch = originalFetch;
  globalThis.RTCPeerConnection = originalRTCPeerConnection;
  globalThis.RTCSessionDescription = originalRTCSessionDescription;
  restoreWindow();
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({ serverUrl: 'http://localhost:9997' });
});

describe('useStreamPlayer refresh stability', () => {
  test('grid moves preserve player instances, connections, volume, and duplicate camera views', async () => {
    const previous = usePlayerStore.getState();
    usePlayerStore.setState({ activeGridStreams: new Map(), gridPlayerIds: new Map(), gridLayout: '2x2' });
    const store = usePlayerStore.getState();
    store.setGridStream(0, 'camera-1');
    store.setGridStream(1, 'camera-1');
    const firstId = usePlayerStore.getState().gridPlayerIds.get(0)!;
    const secondId = usePlayerStore.getState().gridPlayerIds.get(1)!;
    const videos: ReturnType<typeof createVideoNodeMock>[] = [];
    try {
      await act(async () => {
        renderer = create(createElement(MultiPlayerGrid, { streams: [] }), {
          createNodeMock: (element) => {
            if (element.type !== 'video') return null;
            const video = createVideoNodeMock(element);
            videos.push(video);
            return video;
          },
        });
      });
      await flushAsyncWork();
      const players = renderer!.root.findAllByType(VideoPlayer);
      await act(async () => {
        players[0].find((node) => node.type === 'div' && !!node.props.onMouseMove).props.onMouseMove();
      });
      const volume = renderer!.root.findAllByProps({ 'aria-label': 'Volume' })[0];
      await act(async () => { volume.props.onChange({ target: { value: '0.7' } }); });
      expect(connectionStarts).toBe(2);
      expect(connectionCloses).toBe(0);
      expect(videos).toHaveLength(2);

      // Empty move, occupied displacement, then full-grid swap.
      await act(async () => { store.moveGridStream(0, 3, firstId); });
      await act(async () => { store.moveGridStream(3, 1, firstId); });
      expect(usePlayerStore.getState().gridPlayerIds.get(0)).toBe(secondId);
      await act(async () => {
        store.setGridStream(2, 'camera-2');
        store.setGridStream(3, 'camera-3');
      });
      await flushAsyncWork();
      await act(async () => { store.moveGridStream(1, 0, firstId); });
      await flushAsyncWork();
      const movedPlayers = renderer!.root.findAllByType(VideoPlayer);
      expect(movedPlayers[0]).toBe(players[0]);
      expect(movedPlayers[1]).toBe(players[1]);
      expect(connectionStarts).toBe(4);
      expect(connectionCloses).toBe(0);
      expect(videos).toHaveLength(4);
      expect(renderer!.root.findAllByProps({ 'aria-label': 'Volume' })[0].props.value).toBe(0.7);
      expect(videos[0].volume).toBe(0.7);
      expect(videos[0].muted).toBe(false);
      const firstCell = renderer!.root.findByProps({ 'aria-label': 'Grid slot 1, camera-1' });
      expect(firstCell.props.style).toEqual({ gridColumn: 1, gridRow: 1 });
      await act(async () => { firstCell.findByProps({ 'aria-label': 'Close' }).props.onClick(); });
      expect(usePlayerStore.getState().activeGridStreams.has(0)).toBe(false);
      expect(usePlayerStore.getState().gridPlayerIds.get(1)).toBe(secondId);
      expect(connectionCloses).toBe(1);
    } finally {
      await act(async () => { renderer?.unmount(); renderer = undefined; });
      usePlayerStore.setState(previous);
    }
  });

  test('keeps playback connected across same-stream parent rerenders and unchanged config refreshes', async () => {
    await renderPlayer('camera-1');

    expect(connectionStarts).toBe(1);
    expect(connectionCloses).toBe(0);
    expect(fetchUrls).toContain('http://media.example.test:8889/camera-1/whep');

    await updatePlayer('camera-1');
    expect(connectionStarts).toBe(1);
    expect(connectionCloses).toBe(0);

    await replaceConfig({
      logLevel: 'debug',
      rtspAddress: ':8555',
      rtmpAddress: ':1936',
      webrtcAddress: '0.0.0.0:8889',
      hlsAddress: '127.0.0.1:8888',
    });

    expect(connectionStarts).toBe(1);
    expect(connectionCloses).toBe(0);
    expect(currentPlayer?.urls).toEqual({
      whepUrl: 'http://media.example.test:8889/camera-1/whep',
      hlsUrl: 'http://media.example.test:8888/camera-1/index.m3u8',
    });
  });

  test('reconnects when streamName changes', async () => {
    await renderPlayer('camera-1');
    await updatePlayer('camera-2');

    expect(connectionStarts).toBe(2);
    expect(connectionCloses).toBe(1);
    expect(fetchUrls).toContain('http://media.example.test:8889/camera-2/whep');
  });

  test('reconnects when effective playback listener ports change', async () => {
    await renderPlayer('camera-1');
    await replaceConfig({
      webrtcAddress: ':8899',
      hlsAddress: ':8898',
    });

    expect(connectionStarts).toBe(2);
    expect(connectionCloses).toBe(1);
    expect(fetchUrls).toContain('http://media.example.test:8899/camera-1/whep');
    expect(currentPlayer?.urls).toEqual({
      whepUrl: 'http://media.example.test:8899/camera-1/whep',
      hlsUrl: 'http://media.example.test:8898/camera-1/index.m3u8',
    });
  });

  test('manual retry reconnects the current stream with unchanged URLs', async () => {
    await renderPlayer('camera-1');

    await act(async () => {
      currentPlayer?.retry();
    });
    await flushAsyncWork();

    expect(connectionStarts).toBe(2);
    expect(connectionCloses).toBe(1);
    expect(fetchUrls.filter((url) => url === 'http://media.example.test:8889/camera-1/whep'))
      .toHaveLength(2);
  });
});
