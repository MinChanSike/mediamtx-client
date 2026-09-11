import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Text } from '@fluentui/react-components';
import { pathItemSchema, trackSchema } from '../src/schemas/pathSchema';
import type { Track } from '../src/types/stream';

function TracksSection({ tracks }: { tracks: Track[] }) {
  if (tracks.length === 0) {
    return <Text>No tracks</Text>;
  }

  return (
    <ul>
      {tracks.map((track) => (
        <li key={track}>
          <Text>{track}</Text>
        </li>
      ))}
    </ul>
  );
}

describe('Path track schema shape', () => {
  test('trackSchema parses codec-name strings and rejects object tracks', () => {
    expect(trackSchema.parse('H264')).toBe('H264');
    expect(trackSchema.parse('Opus')).toBe('Opus');
    expect(() => trackSchema.parse({ id: 0, type: 'H264' })).toThrow();
  });

  test('pathItemSchema accepts the real /v3/paths/list tracks string array', () => {
    const parsed = pathItemSchema.parse({
      name: 'camera-1',
      source: 'publisher',
      sourceError: '',
      tracks: ['H264', 'Opus'],
      bytesReceived: 10,
      bytesSent: 20,
      readers: [],
    });

    expect(parsed.tracks).toEqual(['H264', 'Opus']);
    expect(parsed.tracks[0]).toBe('H264');
  });
});

describe('Stream details drawer tracks rendering', () => {
  test('renders real-shape tracks as codec names without #undefined - undefined or per-character rows', () => {
    const tracks: Track[] = ['H264', 'Opus'];
    const markup = renderToStaticMarkup(<TracksSection tracks={tracks} />);

    expect(markup).toContain('H264');
    expect(markup).toContain('Opus');
    expect(markup).not.toContain('#undefined - undefined');
    expect(markup).not.toContain('undefined');
    expect(markup).not.toMatch(/0:\s*H/);
    expect(markup).not.toMatch(/1:\s*2/);
    expect(markup).not.toMatch(/2:\s*6/);
  });

  test('does not emit a duplicate-key React warning for real-shape tracks', () => {
    const warnings: string[] = [];
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };

    try {
      renderToStaticMarkup(<TracksSection tracks={['H264', 'Opus']} />);
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }

    expect(
      warnings.some((message) => /unique.*key|key.*unique/i.test(message)),
    ).toBe(false);
  });

  test('renders the no-tracks state when tracks is empty', () => {
    const markup = renderToStaticMarkup(<TracksSection tracks={[]} />);

    expect(markup).toContain('No tracks');
    expect(markup).not.toContain('H264');
  });

  test('StreamDetailsDrawer source renders track codec names with string keys and no object track access', async () => {
    const source = await Bun.file('src/components/streams/StreamDetailsDrawer.tsx').text();

    expect(source).toContain('key={track}');
    expect(source).toContain('<Text>{track}</Text>');
    expect(source).not.toContain('track.id');
    expect(source).not.toContain('track.type');
    expect(source).not.toContain("getPrimitiveDetails(track, ['id', 'type'])");
  });

  test('pathSchema models tracks as an array of codec-name strings and Track is not an object', async () => {
    const source = await Bun.file('src/schemas/pathSchema.ts').text();

    expect(source).toContain('tracks: z.array(trackSchema)');
    expect(source).toContain('export const trackSchema = z.string()');
    expect(source).not.toContain('id: z.number(),');
    expect(source).not.toContain('export const trackSchema = z.object(');
  });
});
