import { describe, expect, test } from 'bun:test';
import { buildConfigSummaryCards } from '@src/components/config/ConfigSummaryView';
import type { GlobalConfig } from '@src/types/config';

const sampleConfig: GlobalConfig = {
  logLevel: 'info',
  logDestinations: ['stdout'],
  logFile: 'mediamtx.log',
  readTimeout: '10s',
  writeTimeout: '10s',
  readBufferCount: 512,
  udpMaxPayloadSize: 1472,
  api: true,
  apiAddress: '127.0.0.1:9997',
  metrics: true,
  metricsAddress: '127.0.0.1:9998',
  pprof: false,
  pprofAddress: undefined,
  playback: true,
  playbackAddress: ':9996',
  rtsp: true,
  hlsAddress: ':8888',
  rtspAddress: ':8554',
  rtmp: true,
  rtmpAddress: ':1935',
  hls: true,
  webrtc: true,
  webrtcAddress: ':8889',
  srt: true,
  srtAddress: ':8890',
  paths: {
    all: {
      source: 'publisher',
      sourceProtocol: 'automatic',
      sourceAnyPublisher: true,
      record: false,
      playback: true,
      maxReaders: 0,
    },
  },
};

describe('buildConfigSummaryCards', () => {
  test('omits protocol-only cards from the summary model', () => {
    const titles = buildConfigSummaryCards(sampleConfig).map((card) => card.title);

    expect(titles).not.toContain('RTSP Protocol');
    expect(titles).not.toContain('RTMP Protocol');
    expect(titles).not.toContain('HLS Protocol');
    expect(titles).not.toContain('WebRTC Protocol');
    expect(titles).not.toContain('SRT Protocol');
  });

  test('includes non-protocol network/runtime and service/access settings', () => {
    const cards = buildConfigSummaryCards(sampleConfig);
    const networkRuntime = cards.find((card) => card.title === 'Network Runtime');
    const serviceAccess = cards.find((card) => card.title === 'Service Access');

    expect(networkRuntime?.fields).toEqual(
      expect.arrayContaining([
        { label: 'Read Timeout', value: '10s' },
        { label: 'Write Timeout', value: '10s' },
        { label: 'Read Buffer Count', value: 512 },
        { label: 'UDP Max Payload Size', value: 1472 },
      ])
    );
    expect(serviceAccess?.fields).toEqual(
      expect.arrayContaining([
        { label: 'API Enabled', value: true },
        { label: 'API Address', value: '127.0.0.1:9997' },
        { label: 'Metrics Enabled', value: true },
        { label: 'Metrics Address', value: '127.0.0.1:9998' },
      ])
    );
  });
});
