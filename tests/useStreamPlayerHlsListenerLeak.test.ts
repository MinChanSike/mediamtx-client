import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useStreamPlayer } from '../src/hooks/useStreamPlayer';
import useAppStore from '../src/store/useAppStore';
import useMediaMTXApiStore from '../src/store/useMediaMTXApiStore';
import type { GlobalConfig } from '../src/types/config';

const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalRTCPeerConnection = globalThis.RTCPeerConnection;
const originalRTCSessionDescription = globalThis.RTCSessionDescription;

type PlayerResult = ReturnType<typeof useStreamPlayer>;
type EventListenerHandler = (event: unknown) => void;

interface VideoMock {
  src: string;
  srcObject: MediaStream | null;
  muted: boolean;
  volume: number;
  canPlayType: (type: string) => string;
  play: () => Promise<void>;
  pause: () => void;
  addEventListener: (type: string, handler: EventListenerHandler) => void;
  removeEventListener: (type: string, handler: EventListenerHandler) => void;
}

let renderer: ReactTestRenderer | undefined;
let currentPlayer: PlayerResult | undefined;
let currentApiConfig: GlobalConfig;
let playCallCount = 0;
let removeCallCount = 0;
let listeners: { type: string; handler: EventListenerHandler }[] = [];
let sharedVideo: VideoMock | undefined;

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
  connectionState: RTCPeerConnectionState = 'new';
  ontrack: RTCPeerConnection['ontrack'] = null;
  onconnectionstatechange: RTCPeerConnection['onconnectionstatechange'] = null;

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
    return undefined;
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

    if (url.endsWith('/v3/config/global/get')) {
      return jsonResponse(currentApiConfig);
    }

    if (url.endsWith('/whep')) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'application/sdp' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }) as typeof fetch;
}

function createVideoNodeMock(element: { type: unknown }) {
  if (element.type !== 'video') return {};

  const node: VideoMock = {
    src: '',
    srcObject: null,
    muted: true,
    volume: 0.5,
    canPlayType: () => 'application/vnd.apple.mpegurl',
    play: () => {
      playCallCount += 1;
      return Promise.resolve();
    },
    pause: () => undefined,
    addEventListener: (type, handler) => {
      listeners.push({ type, handler });
    },
    removeEventListener: (type, handler) => {
      removeCallCount += 1;
      for (let i = listeners.length - 1; i >= 0; i -= 1) {
        if (listeners[i].type === type && listeners[i].handler === handler) {
          listeners.splice(i, 1);
          return;
        }
      }
    },
  };
  sharedVideo = node;
  return node;
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

function listenersOfType(type: string) {
  return listeners.filter((entry) => entry.type === type);
}

function dispatchEvent(type: string): number {
  const snapshot = listeners.filter((entry) => entry.type === type).map((entry) => entry.handler);
  for (const handler of snapshot) {
    handler({ type });
  }
  return snapshot.length;
}

async function retryPlayer() {
  await act(async () => {
    currentPlayer?.retry();
  });
  await flushAsyncWork();
}

beforeEach(() => {
  playCallCount = 0;
  removeCallCount = 0;
  listeners = [];
  sharedVideo = undefined;
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

describe('useStreamPlayer native-HLS listener cleanup', () => {
  test('does not accumulate loadedmetadata/error listeners across WebRTC-to-native-HLS fallbacks', async () => {
    await renderPlayer('camera-1');

    expect(sharedVideo?.canPlayType('application/vnd.apple.mpegurl')).toBe(
      'application/vnd.apple.mpegurl'
    );
    expect(listenersOfType('loadedmetadata')).toHaveLength(1);
    expect(listenersOfType('error')).toHaveLength(1);

    await retryPlayer();
    expect(listenersOfType('loadedmetadata')).toHaveLength(1);
    expect(listenersOfType('error')).toHaveLength(1);

    await retryPlayer();
    expect(listenersOfType('loadedmetadata')).toHaveLength(1);
    expect(listenersOfType('error')).toHaveLength(1);

    expect(removeCallCount).toBe(4);
  });

  test('a single loadedmetadata event triggers exactly one play() and transitions to playing', async () => {
    await renderPlayer('camera-1');
    await retryPlayer();
    await retryPlayer();

    expect(listenersOfType('loadedmetadata')).toHaveLength(1);
    expect(playCallCount).toBe(0);

    let invokedHandlers = 0;
    await act(async () => {
      invokedHandlers = dispatchEvent('loadedmetadata');
    });
    await flushAsyncWork();

    expect(invokedHandlers).toBe(1);
    expect(playCallCount).toBe(1);
    expect(currentPlayer?.status).toBe('playing');
    expect(currentPlayer?.isPlaying).toBe(true);
    expect(currentPlayer?.mode).toBe('hls');
  });
});
