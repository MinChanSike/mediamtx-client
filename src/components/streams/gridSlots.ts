import type { GridLayout } from '@src/store/usePlayerStore';

export function gridSlotCount(gridLayout: GridLayout): number {
  return gridLayout === '1x1' ? 1 : gridLayout === '2x2' ? 4 : gridLayout === '3x3' ? 9 : 16;
}

export function findEmptyGridSlot(
  slotCount: number,
  activeGridStreams: Map<number, string>
): number {
  for (let index = 0; index < slotCount; index += 1) {
    if (!activeGridStreams.has(index)) return index;
  }
  return -1;
}
