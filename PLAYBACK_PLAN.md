# MediaMTX Recorded Playback Page Research Plan

## Summary

Implement a browser-only Playback page for recorded MediaMTX streams. The page should show a surveillance-style timeline for up to four cameras, use direct access to MediaMTX's Control API and playback HTTP server, and keep a synchronized grid aligned to an absolute recording timestamp.

The local MediaMTX server was previously verified as v1.19.2, with the Control API on `http://localhost:9997` and playback enabled on `http://localhost:9996`. The local recording catalog was empty, so implementation can be planned against the API contract, but playback behavior still needs validation with fixture recordings.

Research sources:

- MediaMTX playback documentation: <https://mediamtx.org/docs/features/playback>
- MediaMTX v1.19.2 Control API schema: <https://raw.githubusercontent.com/bluenviron/mediamtx/v1.19.2/api/openapi.yaml>
- MediaMTX v1.19.2 playback `/list` source: <https://github.com/bluenviron/mediamtx/blob/v1.19.2/internal/playback/on_list.go>
- MediaMTX v1.19.2 playback `/get` source: <https://github.com/bluenviron/mediamtx/blob/v1.19.2/internal/playback/on_get.go>
- Browser media codec reference: <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs>

## MediaMTX Playback Facts

MediaMTX separates recording discovery from media playback:

| Purpose | Endpoint | Use in the client |
| --- | --- | --- |
| List recorded paths | `GET /v3/recordings/list?page=0&itemsPerPage=100` on the Control API | Build the recorded-path catalog, including offline streams |
| Get one recorded path | `GET /v3/recordings/get/{name}` on the Control API | Optional detail refresh for a selected path |
| List playable intervals | `GET /list?path=<name>&start=<RFC3339>&end=<RFC3339>` on the playback server | Build timeline availability and source-of-truth durations |
| Play media | `GET /get?path=<name>&start=<RFC3339>&duration=<seconds>&format=fmp4` on the playback server | Assign to native `<video>` sources |

The Control API recording records expose path names and segment start timestamps only. They do not provide playable segment durations. The playback `/list` endpoint returns `start`, `duration`, and `url`, and should be treated as the timeline source of truth.

In MediaMTX v1.19.2, playback accepts `format=fmp4` by default and also supports `format=mp4`. Both are served as `video/mp4`, but the `/get` handler sets `Accept-Ranges: none`, so random access outside the browser's current buffered media requires constructing a new `/get` URL for the target timestamp. The v1.19.2 playback handlers reject MPEG-TS recordings with "MPEG-TS format is not supported yet"; implementation should assume fMP4 recordings are required.

The `/list` implementation concatenates only compatible adjacent fMP4 segments. Preserve returned interval boundaries instead of merging them for playback requests; calculate separate union ranges only for gap navigation and timeline display.

## User-Facing Behavior

Add a `#/playback` route and sidebar item alongside the existing Dashboard and Streams pages. Keep the visual style consistent with the current React, Fluent UI, Zustand, SWR, and HashRouter application.

The Playback page should provide:

- A searchable recorded-path selector populated from `/v3/recordings/list`.
- Explicit assignment of recordings into up to four playback slots.
- Grid layouts for one stream and four streams: `1x1` and `2x2`.
- A shared date/timeline view defaulting to today in the browser's timezone.
- Availability lanes for each assigned stream, with visible gaps and selected intervals.
- Shared controls for play/pause, seek backward/forward 10 seconds, playback rate `0.5x`, `1x`, `2x`, and `4x`.
- Start paused, mute all tiles by default, and allow audio from one selected tile.
- Timestamp entry and click/drag seeking on the timeline.
- Automatic gap skipping only when every selected stream lacks footage at the shared timestamp.
- Per-tile loading, no-recording, decode-error, and retry states.

The grid should keep healthy tiles playing when another tile buffers. A recovering tile should rejoin at the current shared timestamp. Alignment is best effort and should target drift under one second on healthy connections.

## Implementation Plan

Add playback-specific types and validation:

- `RecordingList`, `Recording`, and `RecordingSegment` matching the Control API shape.
- `PlaybackSpan` with `start`, `duration`, and `url`.
- Config parsing for `playbackEncryption` in addition to existing `playback` and `playbackAddress`.

Add API helpers separate from the existing JSON Control API helper:

- Keep using the existing API client for Control API requests after adding recording schemas.
- Add a playback fetch helper for `/list` that omits unnecessary `Content-Type: application/json` headers, accepts `AbortSignal`, and builds URLs with `URL` and `URLSearchParams`.
- Derive the default playback base URL from the API server hostname, `playbackAddress`, and `playbackEncryption`, with a user-editable override persisted per API server.
- Fetch recording catalog pages sequentially until `pageCount` is exhausted.
- Fetch playback intervals only for assigned streams and the selected day.

Add playback state separate from live-stream state:

- Do not reuse the existing live WebRTC/HLS player controller for recorded playback.
- Store assigned playback slots, selected day, layout, playback endpoint override, shared timestamp, playback state, rate, and selected audio slot in a dedicated Zustand slice or store.
- Key SWR resources by API server, playback endpoint, path, and day. Reject stale responses after server, path, or day changes.
- Refresh the catalog on page entry and explicit refresh. Refresh today's interval availability about every 30 seconds while visible without restarting active video elements.

Add a recorded video controller:

- Use native `<video>` elements with `type="video/mp4"`.
- Maintain a monotonic shared clock mapped to an absolute recording timestamp.
- On committed seek, choose each tile's containing `PlaybackSpan`, then request a bounded `/get` URL from the target timestamp for up to five minutes or until the interval ends.
- At the end of a bounded media request, request the next compatible interval segment if playback is still active.
- Check drift every 250 ms while playing. If a tile drifts by more than one second, correct with `currentTime` when seekable, otherwise reload that tile at the shared timestamp.
- Avoid overlapping reloads, infinite retries, and full-grid pauses caused by one failing tile.
- Release media resources on slot removal, route navigation, server change, or unmount.

## Edge Cases And Errors

Handle these states distinctly:

- Playback server disabled or unreachable.
- Control API unavailable.
- Empty recording catalog.
- Assigned path has no intervals for the selected day.
- `/list` returns `404` because no segments exist in the requested range.
- Unsupported recording format, especially MPEG-TS on v1.19.2.
- Browser decode failure due to codec support, even when the MP4 container is valid.
- CORS or auth failure on the playback server.
- Partial coverage where one camera has footage and another has a gap.
- Day boundaries across daylight-saving transitions.

Authorization is out of scope for the first implementation. The planned page assumes direct browser access to the API and playback server with permissive CORS, matching the verified local configuration.

## Test Plan

Unit-test:

- Recording pagination and schema validation.
- Playback URL construction, including nested path names and RFC3339 encoding.
- Default playback endpoint derivation from config and API server URL.
- Interval clipping, boundary preservation, gap union calculation, and day-boundary handling.
- Stale-response rejection after path, server, endpoint, or day changes.
- Shared-clock gap skipping when every selected stream lacks footage.

Component-test:

- Path assignment, slot removal, and `1x1`/`2x2` layout changes.
- Timeline seeking, timestamp entry, play/pause, rate changes, and selected audio tile.
- Per-tile buffering and recovery while other tiles continue.
- Empty catalog, no intervals, playback endpoint failure, and decode-error UI.

Integration-test with an isolated MediaMTX fixture:

- Use MediaMTX v1.19.2 with four H.264/AAC fMP4 recordings, overlapping coverage, intentional gaps, and timestamp overlays.
- Verify offline recorded streams appear in the catalog.
- Verify seek behavior beyond currently buffered media creates new `/get` URLs.
- Verify five-minute media-request rollover.
- Verify alignment remains within one second under healthy local network conditions.
- Run the app's Bun tests, typecheck, lint, and production build.

## Assumptions And Defaults

- Build a surveillance timeline, not a simple file browser.
- Support up to four streams in `1x1` and `2x2` layouts.
- Skip gaps automatically only when all selected streams are unavailable.
- Keep tiles independent during buffering and errors.
- Target timestamp-level synchronization within one second, not frame-level synchronization.
- Prefer `format=fmp4` for first implementation.
- Do not implement export, deletion, recording configuration changes, authentication UI, or a backend proxy in this phase.
