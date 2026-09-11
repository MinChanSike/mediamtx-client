import { afterEach, describe, expect, test } from 'bun:test';
import { addStreamSchema } from '../src/hooks/useAddStream';
import { runAddStreamMutation } from '../src/hooks/useMediaMTXApi';
import useAppStore from '../src/store/useAppStore';
import useMediaMTXApiStore from '../src/store/useMediaMTXApiStore';

const originalFetch = globalThis.fetch;

const TRIMMED = 'rtsp://camera:554/stream';

function resetState(serverUrl = 'http://add-trim.test') {
  useMediaMTXApiStore.getState().resetForServerUrl('');
  useAppStore.setState({ serverUrl });
  useMediaMTXApiStore.getState().resetForServerUrl(serverUrl);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetState('');
});

describe('Add Stream sourceUri trimming', () => {
  test('trims leading/trailing whitespace (spaces, tabs, newlines) before returning sourceUri', () => {
    for (const padded of [
      ' rtsp://camera:554/stream ',
      '\trtsp://camera:554/stream\t',
      'rtsp://camera:554/stream\n',
    ]) {
      const result = addStreamSchema.safeParse({
        pathName: 'cam1',
        protocol: 'rtsp',
        sourceUri: padded,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.sourceUri).toBe(TRIMMED);
    }
  });

  test('rejects an all-whitespace sourceUri as required (trim must run before the min check)', () => {
    const result = addStreamSchema.safeParse({
      pathName: 'cam1',
      protocol: 'rtsp',
      sourceUri: '   \n\t ',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path[0] === 'sourceUri' && issue.message === 'Source URI is required'
        )
      ).toBe(true);
    }
  });

  test('forwards the validated (trimmed) sourceUri to the API, not the raw input', async () => {
    const captured: { url: string; body: string | undefined }[] = [];
    resetState();
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v3/config/paths/add/cam1')) {
        captured.push({ url, body: init?.body == null ? undefined : String(init.body) });
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const result = addStreamSchema.safeParse({
      pathName: 'cam1',
      protocol: 'rtsp',
      sourceUri: ' rtsp://camera:554/stream ',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    await runAddStreamMutation(result.data);

    const addCall = captured.find((request) => request.url.endsWith('/v3/config/paths/add/cam1'));
    const body = JSON.parse(addCall?.body ?? '{}');
    expect(result.data.sourceUri).toBe(TRIMMED);
    expect(body.source).toBe(TRIMMED);
    expect(body.source).toBe(result.data.sourceUri);
  });
});
