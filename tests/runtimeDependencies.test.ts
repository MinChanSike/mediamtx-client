import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('runtime dependencies', () => {
  test('declares the drag-and-drop and uptime packages as runtime dependencies', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as {
      dependencies: Record<string, string>;
    };

    expect(packageJson.dependencies['@atlaskit/pragmatic-drag-and-drop']).toBeString();
    expect(packageJson.dependencies['humanize-duration']).toBeString();
  });
});
