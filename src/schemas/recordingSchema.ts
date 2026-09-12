import { z } from 'zod';

/**
 * A recorded segment as reported by the Control API. The Control API only
 * exposes segment start timestamps; playable durations come from the playback
 * server `/list` endpoint instead.
 */
export const recordingSegmentSchema = z
  .object({
    start: z.string(),
  })
  .passthrough();

export const recordingSchema = z
  .object({
    name: z.string(),
    segments: z.array(recordingSegmentSchema),
  })
  .passthrough();

export const recordingListSchema = z.object({
  itemCount: z.number(),
  pageCount: z.number(),
  items: z.array(recordingSchema),
});

/**
 * A playable interval returned by the playback server `/list` endpoint.
 * `start` is RFC3339, `duration` is a float number of seconds and `url` points
 * at the `/get` endpoint for the interval.
 */
export const playbackSpanSchema = z
  .object({
    start: z.string(),
    duration: z.number().nonnegative(),
    url: z.string(),
  })
  .passthrough();

export type RecordingSegment = z.infer<typeof recordingSegmentSchema>;
export type Recording = z.infer<typeof recordingSchema>;
export type RecordingList = z.infer<typeof recordingListSchema>;
export type PlaybackSpan = z.infer<typeof playbackSpanSchema>;
