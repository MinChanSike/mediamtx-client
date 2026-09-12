/**
 * A monotonic shared clock for synchronized recorded playback.
 *
 * The clock maps wall-clock progress to an absolute recording timestamp so
 * every tile in the grid can be aligned to the same point in recording time.
 * It re-anchors on every play, pause, seek, and rate change; while paused it
 * freezes at the anchored position.
 */

export type MonotonicNow = () => number;

const defaultNow: MonotonicNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export class SharedClock {
  private anchorAbsMs: number;
  private anchorMono: number;
  private rate: number;
  private playing: boolean;

  constructor(
    startAbsMs: number,
    private readonly nowFn: MonotonicNow = defaultNow
  ) {
    this.anchorAbsMs = startAbsMs;
    this.anchorMono = nowFn();
    this.rate = 1;
    this.playing = false;
  }

  /** Current absolute recording position in epoch milliseconds. */
  positionMs(): number {
    if (!this.playing) return this.anchorAbsMs;
    const elapsedMono = this.nowFn() - this.anchorMono;
    return this.anchorAbsMs + elapsedMono * this.rate;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getRate(): number {
    return this.rate;
  }

  play(): void {
    if (this.playing) return;
    this.anchorMono = this.nowFn();
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.anchorAbsMs = this.positionMs();
    this.playing = false;
  }

  /** Jumps the anchored position (used for committed seeks and gap skips). */
  seek(absMs: number): void {
    this.anchorAbsMs = absMs;
    this.anchorMono = this.nowFn();
  }

  setRate(rate: number): void {
    this.anchorAbsMs = this.positionMs();
    this.anchorMono = this.nowFn();
    this.rate = rate;
  }
}
