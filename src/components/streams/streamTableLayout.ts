const OVERFLOW_TOLERANCE_PX = 1;

export function shouldEnableTableScroll(scrollHeight: number, clientHeight: number): boolean {
  return scrollHeight - clientHeight > OVERFLOW_TOLERANCE_PX;
}
