import { buildPlaybackGetUrl } from '@src/api/playbackSyncApi';
import { SharedClock } from '@src/playbackSync/sharedClock';
import {
  computeGapSkipTarget,
  findSpanAt,
  hasCoverageAt,
  type NormalizedSpan,
} from '@src/utils/playbackSyncIntervals';

/**
 * Recorded playback grid controller.
 *
 * Owns the shared clock and one runtime per playback tile. Each tile uses a
 * native `<video>` element fed by bounded `/get` requests (at most five
 * minutes or until the containing interval ends). Because the playback
 * server sends `Accept-Ranges: none`, seeks outside the currently buffered
 * media are implemented by constructing a new `/get` URL for the target
 * timestamp rather than seeking inside the element.
 *
 * Tiles are kept independent: a buffering or failing tile never pauses the
 * grid, and a recovering tile rejoins at the current shared timestamp.
 */

/** Bounded media-request rollover window, in seconds. */
export const MAX_MEDIA_REQUEST_SECONDS = 300;
export const DRIFT_CHECK_INTERVAL_MS = 250;
/** Drift correction threshold for healthy tiles (plan: under one second). */
export const DRIFT_CORRECTION_THRESHOLD_MS = 1000;
/**
 * Drift threshold for a stalled tile: while buffering, a tile's currentTime
 * freezes by design; only a prolonged stall beyond this window triggers a
 * rejoin at the shared timestamp so healthy tiles are never paused.
 */
export const BUFFERING_STALL_RECOVERY_MS = 5000;

export type TileStatus = 'idle' | 'loading' | 'ready' | 'gap' | 'no-recording' | 'error';
export type TileErrorCode = 'endpoint' | 'network' | 'decode';

export interface TileSnapshot {
  status: TileStatus;
  errorCode: TileErrorCode | null;
  errorMessage: string | null;
  isBuffering: boolean;
}

export interface PlaybackSyncGridSnapshot {
  version: number;
  tiles: Record<string, TileSnapshot>;
}

type BuildGetUrl = typeof buildPlaybackGetUrl;

interface TileRuntime {
  slot: number;
  path: string;
  video: HTMLVideoElement;
  detachListeners: () => void;
  spans: NormalizedSpan[] | null;
  mediaStartMs: number | null;
  mediaEndMs: number | null;
  requestToken: number;
  status: TileStatus;
  errorCode: TileErrorCode | null;
  errorMessage: string | null;
  isBuffering: boolean;
}

export interface RecordedPlaybackSyncControllerOptions {
  initialPositionMs?: number;
  buildGetUrl?: BuildGetUrl;
  /** Injectable monotonic clock for tests. */
  nowFn?: () => number;
}

const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

const HAVE_FUTURE_DATA = 3;

function tileSnapshotOf(tile: TileRuntime): TileSnapshot {
  return {
    status: tile.status,
    errorCode: tile.errorCode,
    errorMessage: tile.errorMessage,
    isBuffering: tile.isBuffering,
  };
}

export class RecordedPlaybackSyncController {
  private readonly clock: SharedClock;
  private readonly buildGetUrl: BuildGetUrl;
  private readonly tiles = new Map<number, TileRuntime>();
  private readonly listeners = new Set<() => void>();
  private endpoint: string | null = null;
  private rate = 1;
  private audioSlot: number | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private snapshot: PlaybackSyncGridSnapshot = { version: 0, tiles: {} };
  private disposed = false;

  constructor(options: RecordedPlaybackSyncControllerOptions = {}) {
    this.clock = new SharedClock(options.initialPositionMs ?? 0, options.nowFn);
    this.buildGetUrl = options.buildGetUrl ?? buildPlaybackGetUrl;
  }

  // ---------------------------------------------------------------------
  // React integration
  // ---------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PlaybackSyncGridSnapshot => this.snapshot;

  private emit(): void {
    if (this.disposed) return;
    const tiles: Record<string, TileSnapshot> = {};
    for (const tile of this.tiles.values()) {
      tiles[String(tile.slot)] = tileSnapshotOf(tile);
    }
    this.snapshot = { version: this.snapshot.version + 1, tiles };
    for (const listener of this.listeners) {
      listener();
    }
  }

  // ---------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------

  /** Sets the playback server base URL; null marks the endpoint unavailable. */
  setEndpoint(baseUrl: string | null): void {
    if (this.disposed || this.endpoint === baseUrl) return;
    this.endpoint = baseUrl;

    for (const tile of this.tiles.values()) {
      if (baseUrl === null) {
        this.releaseMedia(tile);
        tile.status = 'error';
        tile.errorCode = 'endpoint';
        tile.errorMessage = 'Playback server endpoint is not available.';
      } else {
        this.loadMediaAt(tile, this.clock.positionMs());
      }
    }
    this.emit();
  }

  /**
   * Updates the playable intervals for a path. Refreshed interval data must
   * never restart tiles that are already playing inside a valid span; it is
   * only used to recover tiles waiting in a gap or lacking data.
   */
  setSpans(path: string, spans: NormalizedSpan[] | null): void {
    if (this.disposed) return;

    for (const tile of this.tiles.values()) {
      if (tile.path !== path) continue;
      tile.spans = spans;
      if (tile.status === 'loading' || tile.status === 'gap' || tile.status === 'no-recording') {
        this.loadMediaAt(tile, this.clock.positionMs());
      }
    }
    this.emit();
  }

  // ---------------------------------------------------------------------
  // Tile lifecycle
  // ---------------------------------------------------------------------

  attachVideo(slot: number, path: string, video: HTMLVideoElement): void {
    if (this.disposed) return;
    this.detachVideo(slot);

    const tile: TileRuntime = {
      slot,
      path,
      video,
      detachListeners: () => undefined,
      spans: null,
      mediaStartMs: null,
      mediaEndMs: null,
      requestToken: 0,
      status: 'loading',
      errorCode: null,
      errorMessage: null,
      isBuffering: false,
    };
    tile.detachListeners = this.wireVideoEvents(tile);
    this.tiles.set(slot, tile);

    video.muted = this.audioSlot === null || slot !== this.audioSlot;
    video.playbackRate = this.rate;

    if (this.endpoint === null) {
      tile.status = 'error';
      tile.errorCode = 'endpoint';
      tile.errorMessage = 'Playback server endpoint is not available.';
    } else if (!this.clock.isPlaying()) {
      // Load the frame at the current shared position without autoplay.
      this.loadMediaAt(tile, this.clock.positionMs());
    }

    this.emit();
  }

  detachVideo(slot: number): void {
    const tile = this.tiles.get(slot);
    if (!tile) return;

    tile.detachListeners();
    this.releaseMedia(tile);
    this.tiles.delete(slot);
    this.emit();
  }

  private releaseMedia(tile: TileRuntime): void {
    tile.mediaStartMs = null;
    tile.mediaEndMs = null;
    tile.isBuffering = false;
    tile.requestToken += 1;
    try {
      tile.video.pause();
      tile.video.removeAttribute('src');
      tile.video.load();
    } catch {
      // Releasing media is best effort; a failing element is replaced on the
      // next attach.
    }
  }

  private wireVideoEvents(tile: TileRuntime): () => void {
    const video = tile.video;
    const bindings: Array<[string, () => void]> = [];

    const on = (type: string, handler: () => void) => {
      video.addEventListener(type, handler);
      bindings.push([type, handler]);
    };

    on('loadedmetadata', () => {
      const duration = video.duration;
      if (tile.mediaStartMs !== null && Number.isFinite(duration) && duration > 0) {
        // The server may deliver less media than requested when the interval
        // ends early; trust the element's duration as the true bound.
        tile.mediaEndMs = tile.mediaStartMs + duration * 1000;
      }
    });

    on('canplay', () => {
      this.updateBuffering(tile);
      if (this.clock.isPlaying() && tile.status !== 'error') {
        this.tryPlay(tile);
      }
    });

    on('playing', () => {
      tile.isBuffering = false;
      if (tile.status === 'loading' || tile.status === 'gap') {
        tile.status = 'ready';
        tile.errorCode = null;
        tile.errorMessage = null;
      }
      this.emit();
    });

    on('waiting', () => {
      this.updateBuffering(tile);
      this.emit();
    });

    on('seeking', () => {
      this.updateBuffering(tile);
      this.emit();
    });

    on('seeked', () => {
      this.updateBuffering(tile);
      this.emit();
    });

    on('ended', () => {
      this.onTileEnded(tile);
    });

    on('error', () => {
      this.onTileError(tile);
    });

    return () => {
      for (const [type, handler] of bindings) {
        video.removeEventListener(type, handler);
      }
    };
  }

  private updateBuffering(tile: TileRuntime): void {
    tile.isBuffering = tile.video.readyState < HAVE_FUTURE_DATA;
  }

  private tryPlay(tile: TileRuntime): void {
    const playback = tile.video.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {
        // Autoplay may be rejected before a user gesture; the tile stays
        // paused and catches up on the next play action or drift pass.
      });
    }
  }

  // ---------------------------------------------------------------------
  // Media loading
  // ---------------------------------------------------------------------

  /**
   * Points a tile's `<video>` at a bounded `/get` request covering the
   * shared timestamp. Chooses the containing span and requests up to five
   * minutes or until the interval ends, whichever comes first.
   */
  private loadMediaAt(tile: TileRuntime, absMs: number): void {
    if (this.disposed) return;

    if (this.endpoint === null) {
      tile.status = 'error';
      tile.errorCode = 'endpoint';
      tile.errorMessage = 'Playback server endpoint is not available.';
      this.releaseMedia(tile);
      this.emit();
      return;
    }

    if (tile.spans === null) {
      tile.status = 'loading';
      tile.errorCode = null;
      tile.errorMessage = null;
      this.emit();
      return;
    }

    if (tile.spans.length === 0) {
      tile.status = 'no-recording';
      tile.errorCode = null;
      tile.errorMessage = null;
      this.releaseMedia(tile);
      this.emit();
      return;
    }

    const span = findSpanAt(tile.spans, absMs);
    if (!span) {
      tile.status = 'gap';
      tile.errorCode = null;
      tile.errorMessage = null;
      this.releaseMedia(tile);
      this.emit();
      return;
    }

    const requestStartMs = Math.max(absMs, span.startMs);
    const remainingSec = (span.endMs - requestStartMs) / 1000;
    const durationSec = Math.min(remainingSec, MAX_MEDIA_REQUEST_SECONDS);

    tile.requestToken += 1;
    tile.mediaStartMs = requestStartMs;
    tile.mediaEndMs = requestStartMs + durationSec * 1000;
    tile.status = 'loading';
    tile.errorCode = null;
    tile.errorMessage = null;
    tile.isBuffering = false;

    tile.video.src = this.buildGetUrl(this.endpoint, tile.path, requestStartMs, durationSec);
    tile.video.playbackRate = this.rate;
    tile.video.load();

    if (this.clock.isPlaying()) {
      this.tryPlay(tile);
    }
    this.emit();
  }

  private onTileEnded(tile: TileRuntime): void {
    if (this.disposed || !this.clock.isPlaying()) return;
    // Chain the next compatible interval chunk from the shared position; the
    // server concatenates adjacent fMP4 segments on its side.
    this.loadMediaAt(tile, this.clock.positionMs());
  }

  private onTileError(tile: TileRuntime): void {
    if (this.disposed) return;

    const mediaError: MediaError | null = tile.video.error;
    if (!mediaError || mediaError.code === MEDIA_ERR_ABORTED) return;

    let errorCode: TileErrorCode = 'network';
    let message = 'The recording could not be loaded from the playback server.';
    if (mediaError.code === MEDIA_ERR_DECODE || mediaError.code === MEDIA_ERR_SRC_NOT_SUPPORTED) {
      errorCode = 'decode';
      message =
        'The browser could not decode this recording. The codec or recording format may be unsupported.';
    }

    tile.status = 'error';
    tile.errorCode = errorCode;
    tile.errorMessage = message;
    tile.isBuffering = false;
    this.emit();
  }

  /** Manual per-tile retry: reload at the current shared timestamp. */
  retryTile(slot: number): void {
    const tile = this.tiles.get(slot);
    if (!tile || this.disposed) return;
    this.loadMediaAt(tile, this.clock.positionMs());
  }

  // ---------------------------------------------------------------------
  // Transport
  // ---------------------------------------------------------------------

  play(): void {
    if (this.disposed || this.clock.isPlaying()) return;
    this.clock.play();
    this.ensureTick();

    const positionMs = this.clock.positionMs();
    for (const tile of this.tiles.values()) {
      if (
        tile.status === 'ready' &&
        tile.mediaStartMs !== null &&
        tile.mediaEndMs !== null &&
        positionMs >= tile.mediaStartMs &&
        positionMs < tile.mediaEndMs
      ) {
        this.tryPlay(tile);
      } else {
        this.loadMediaAt(tile, positionMs);
      }
    }
    this.emit();
  }

  pause(): void {
    if (this.disposed) return;
    this.clock.pause();
    this.stopTick();
    for (const tile of this.tiles.values()) {
      try {
        tile.video.pause();
      } catch {
        // Best effort; element may already be released.
      }
    }
    this.emit();
  }

  /** Committed seek: re-anchors the shared clock and reloads every tile. */
  seekTo(absMs: number): void {
    if (this.disposed) return;
    this.clock.seek(absMs);
    for (const tile of this.tiles.values()) {
      this.loadMediaAt(tile, absMs);
    }
    this.emit();
  }

  /** Relative seek in seconds (shared controls: +/- 10s). */
  nudge(deltaSeconds: number): void {
    this.seekTo(this.clock.positionMs() + deltaSeconds * 1000);
  }

  setRate(rate: number): void {
    if (this.disposed) return;
    this.clock.setRate(rate);
    this.rate = rate;
    for (const tile of this.tiles.values()) {
      tile.video.playbackRate = rate;
    }
  }

  /**
   * Selects the single tile allowed to emit audio; every other tile stays
   * muted. Null (the default) mutes the whole grid.
   */
  setAudioSlot(slot: number | null): void {
    if (this.disposed) return;
    this.audioSlot = slot;
    for (const tile of this.tiles.values()) {
      tile.video.muted = tile.slot !== slot;
    }
  }

  isPlaying(): boolean {
    return this.clock.isPlaying();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  getRate(): number {
    return this.clock.getRate();
  }

  getPositionMs(): number {
    return this.clock.positionMs();
  }

  // ---------------------------------------------------------------------
  // Synchronization loop
  // ---------------------------------------------------------------------

  private ensureTick(): void {
    if (this.tickTimer || this.disposed) return;
    this.tickTimer = setInterval(() => this.runSyncPass(), DRIFT_CHECK_INTERVAL_MS);
  }

  private stopTick(): void {
    if (!this.tickTimer) return;
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  /**
   * One synchronization pass: recovers gap tiles whose footage has been
   * reached, corrects drift, and applies shared-clock gap skipping. Runs
   * automatically every 250 ms while playing; exposed for tests.
   */
  runSyncPass(): void {
    if (this.disposed || !this.clock.isPlaying()) return;

    const positionMs = this.clock.positionMs();
    const spansByTile: Array<NormalizedSpan[] | null> = [];

    for (const tile of this.tiles.values()) {
      spansByTile.push(tile.spans);

      if (tile.spans === null) continue;

      if (tile.status === 'gap' && hasCoverageAt(tile.spans, positionMs)) {
        // The shared clock reached this stream's next footage.
        this.loadMediaAt(tile, positionMs);
        continue;
      }

      if (tile.status === 'ready' || tile.status === 'loading') {
        this.correctDrift(tile, positionMs);
      }
    }

    // Automatic gap skipping fires only when every selected stream lacks
    // footage at the shared timestamp (and all interval data is loaded).
    const skipTargetMs = computeGapSkipTarget(spansByTile, positionMs);
    if (skipTargetMs !== null && skipTargetMs > positionMs) {
      this.seekTo(skipTargetMs);
    }
  }

  private correctDrift(tile: TileRuntime, positionMs: number): void {
    const video = tile.video;
    if (tile.mediaStartMs === null) return;
    if (!video.seekable || video.seekable.length === 0) return;

    const tilePositionMs = tile.mediaStartMs + video.currentTime * 1000;
    const deltaMs = positionMs - tilePositionMs;
    const thresholdMs = tile.isBuffering
      ? BUFFERING_STALL_RECOVERY_MS
      : DRIFT_CORRECTION_THRESHOLD_MS;
    if (Math.abs(deltaMs) <= thresholdMs) return;

    const targetTimeSec = (positionMs - tile.mediaStartMs) / 1000;
    if (targetTimeSec < 0) {
      // The shared position moved before the loaded media begins.
      this.loadMediaAt(tile, positionMs);
      return;
    }

    const seekableStart = video.seekable.start(0);
    const seekableEnd = video.seekable.end(video.seekable.length - 1);
    if (targetTimeSec >= seekableStart && targetTimeSec <= seekableEnd) {
      video.currentTime = targetTimeSec;
    } else {
      // Outside the seekable window: construct a new /get request at the
      // shared timestamp (Accept-Ranges: none forbids random access).
      this.loadMediaAt(tile, positionMs);
    }
  }

  // ---------------------------------------------------------------------
  // Teardown
  // ---------------------------------------------------------------------

  /** Releases every media resource; the controller cannot be reused. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTick();
    for (const tile of this.tiles.values()) {
      tile.detachListeners();
      this.releaseMedia(tile);
    }
    this.tiles.clear();
  }
}
