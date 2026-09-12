import { describe, expect, test } from 'bun:test';
import { getVisibleSlotPaths } from '../src/pages/PlaybackPage';

describe('recorded playback visible slots', () => {
  const assigned = ['cam-a', 'cam-b', 'cam-c', 'cam-d'];

  test('keeps the first two slots active in the 1x2 layout', () => {
    expect(getVisibleSlotPaths(assigned, 2)).toEqual(['cam-a', 'cam-b', null, null]);
  });

  test('keeps all four slots active in the 2x2 layout', () => {
    expect(getVisibleSlotPaths(assigned, 4)).toEqual(assigned);
  });

  test('preserves empty visible slots', () => {
    expect(getVisibleSlotPaths(['cam-a', null, 'cam-c', null], 4)).toEqual([
      'cam-a',
      null,
      'cam-c',
      null,
    ]);
  });
});
