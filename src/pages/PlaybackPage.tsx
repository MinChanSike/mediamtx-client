import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import PageHeader from "@src/components/common/PageHeader";
import PlaybackFileList from "@src/components/playback/PlaybackFileList";
import PlaybackSeekBar from "@src/components/playback/PlaybackSeekBar";
import PlaybackStreamList from "@src/components/playback/PlaybackStreamList";
import PlaybackToolbar from "@src/components/playback/PlaybackToolbar";
import PlaybackViewer from "@src/components/playback/PlaybackViewer";
import { usePlaybackSyncEndpoint } from "@src/hooks/usePlaybackSyncEndpoint";
import { usePlaybackStreams } from "@src/hooks/usePlaybackStreams";
import { useRecordedFiles } from "@src/hooks/useRecordedFiles";
import {
  MAX_FILE_WINDOW_MS,
  WINDOW_ROLLOVER_MARGIN_MS,
  buildFileDownloadUrl,
  buildFileWindowSourceUrl,
  findAdjacentFile,
  recordedFileKey,
  type RecordedFile,
} from "@src/api/playbackApi";
import usePlaybackStore from "@src/store/usePlaybackStore";

const useStyles = makeStyles({
  root: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 40px)",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
  },
  workspace: {
    display: "flex",
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    overflow: "hidden",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  stage: {
    display: "flex",
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    flexDirection: "column",
    overflow: "hidden",
  },
  noticeStack: {
    position: "absolute",
    top: "40px",
    right: 0,
    left: "448px",
    zIndex: 5,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    pointerEvents: "none",
    "@media (max-width: 900px)": {
      left: "360px",
    },
  },
  notice: {
    pointerEvents: "auto",
  },
});

function buildDownloadFileName(streamName: string, file: RecordedFile): string {
  const safeStream = streamName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${safeStream}_${file.startIso.replace(/[:.]/g, "-")}.mp4`;
}

/**
 * Recorded-file playback page: pick a stream, pick one of its recorded files
 * (or let auto play advance through consecutive files), scrub with the file
 * timeline, and download files for export. Independent of the multi-stream
 * Playback Sync page.
 */
export default function PlaybackPage() {
  const styles = useStyles();
  const streamsCatalog = usePlaybackStreams();
  const endpoint = usePlaybackSyncEndpoint();

  const autoplayEnabled = usePlaybackStore((s) => s.autoplayEnabled);
  const setAutoplayEnabled = usePlaybackStore((s) => s.setAutoplayEnabled);
  const rate = usePlaybackStore((s) => s.rate);
  const setRate = usePlaybackStore((s) => s.setRate);

  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [measuredDurationMs, setMeasuredDurationMs] = useState(0);
  const [windowStartMs, setWindowStartMs] = useState(0);
  const [windowDurationMs, setWindowDurationMs] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldAutoStartRef = useRef(false);

  const filesResult = useRecordedFiles(
    endpoint.status === "ready" ? endpoint.baseUrl : null,
    selectedStream,
  );

  // Select the first stream once the catalog loads so the files column is
  // immediately useful.
  useEffect(() => {
    if (selectedStream === null && streamsCatalog.recordings.length > 0) {
      setSelectedStream(streamsCatalog.recordings[0].name);
    }
  }, [selectedStream, streamsCatalog.recordings]);

  // Drop a selected file that no longer exists after a catalog refresh.
  useEffect(() => {
    if (selectedKey === null || filesResult.isLoading) return;
    if (
      filesResult.files.length > 0 &&
      !filesResult.files.some((f) => recordedFileKey(f) === selectedKey)
    ) {
      setSelectedKey(null);
    }
  }, [selectedKey, filesResult.files, filesResult.isLoading]);

  const selectedFile = useMemo(
    () =>
      filesResult.files.find((file) => recordedFileKey(file) === selectedKey) ??
      null,
    [filesResult.files, selectedKey],
  );

  const sourceUrl = useMemo(
    () =>
      endpoint.baseUrl && selectedStream && selectedFile
        ? buildFileWindowSourceUrl(
            endpoint.baseUrl,
            selectedStream,
            selectedFile,
            windowStartMs,
            windowDurationMs,
          )
        : null,
    [
      endpoint.baseUrl,
      selectedStream,
      selectedFile,
      windowStartMs,
      windowDurationMs,
    ],
  );

  const fullDurationMs =
    sourceUrl === null
      ? 0
      : Math.max(selectedFile?.durationMs ?? 0, measuredDurationMs);

  // The rollover listener runs from a stable effect, so it reads the current
  // window through a ref instead of stale state closures.
  const windowRef = useRef({
    startMs: 0,
    durationMs: 0,
    fileDurationMs: 0,
    file: null as RecordedFile | null,
  });
  windowRef.current = {
    startMs: windowStartMs,
    durationMs: windowDurationMs,
    fileDurationMs: fullDurationMs,
    file: selectedFile,
  };

  /**
   * Opens a bounded /get window of the selected file starting at `targetMs`
   * (file-relative). The playback server has no range requests, so this is the
   * only way to move the playhead outside the currently buffered window.
   */
  const openWindowAt = useCallback((targetMs: number, autoStart: boolean) => {
    const { file, fileDurationMs } = windowRef.current;
    if (!file) return;
    const boundedDuration = Math.max(
      1_000,
      Math.max(0, fileDurationMs - targetMs),
    );
    const duration = Math.min(MAX_FILE_WINDOW_MS, boundedDuration);
    const start = Math.max(
      0,
      Math.min(targetMs, Math.max(0, fileDurationMs - 1_000)),
    );
    shouldAutoStartRef.current = shouldAutoStartRef.current || autoStart;
    setWindowStartMs(start);
    setWindowDurationMs(duration);
  }, []);

  const selectFile = useCallback((file: RecordedFile, autoStart: boolean) => {
    shouldAutoStartRef.current = autoStart;
    setHasVideoError(false);
    setMeasuredDurationMs(file.durationMs);
    setWindowStartMs(0);
    setWindowDurationMs(
      Math.min(MAX_FILE_WINDOW_MS, Math.max(1_000, file.durationMs)),
    );
    setSelectedKey(recordedFileKey(file));
  }, []);

  const advanceFile = useCallback(
    (delta: 1 | -1) => {
      if (!selectedStream) return;
      const adjacent = findAdjacentFile(filesResult.files, selectedKey, delta);
      if (adjacent) selectFile(adjacent, true);
    },
    [filesResult.files, selectedKey, selectedStream, selectFile],
  );

  const handleDownload = useCallback(
    async (file: RecordedFile) => {
      if (!endpoint.baseUrl || !selectedStream) return;
      const url = buildFileDownloadUrl(endpoint.baseUrl, selectedStream, file);
      try {
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`Download failed with ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = buildDownloadFileName(selectedStream, file);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } catch {
        window.open(url, "_blank", "noopener");
      }
    },
    [endpoint.baseUrl, selectedStream],
  );

  // Apply the persisted rate whenever it or the loaded file changes.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
  }, [rate, sourceUrl]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (!autoplayEnabled) return;
    const next = findAdjacentFile(filesResult.files, selectedKey, 1);
    if (next && recordedFileKey(next) !== selectedKey) selectFile(next, true);
  }, [autoplayEnabled, filesResult.files, selectedKey, selectFile]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.onplay = () => setIsPlaying(true);
    video.onpause = () => setIsPlaying(false);
    video.onended = handleEnded;
    video.ontimeupdate = () => {
      const { startMs, durationMs, fileDurationMs } = windowRef.current;
      const positionMs = startMs + video.currentTime * 1000;
      const windowEndMs = startMs + durationMs;
      if (
        durationMs > 0 &&
        positionMs >= windowEndMs - WINDOW_ROLLOVER_MARGIN_MS &&
        windowEndMs < fileDurationMs - 500
      ) {
        openWindowAt(windowEndMs, !video.paused);
      }
    };
    video.ondurationchange = () => {
      const value = Number.isFinite(video.duration)
        ? Math.round(video.duration * 1000)
        : 0;
      setMeasuredDurationMs((current) => Math.max(current, value));
    };
    video.onwaiting = () => setIsBuffering(true);
    video.onplaying = () => setIsBuffering(false);
    video.oncanplay = () => setIsBuffering(false);
    video.onerror = () => {
      setHasVideoError(true);
      setIsBuffering(false);
      setIsPlaying(false);
    };
    // The handlers must be in place before autostart calls play(): the `play`
    // event can fire before a later-declared effect would attach them.
  }, [sourceUrl, handleEnded, filesResult.files, openWindowAt]);

  // Autostart after switching files when the user picked the file or auto
  // play advanced to it. Every window swap remounts the <video>, and the old
  // element never fires `pause`, so the button state is reconciled here: the
  // fresh element is paused unless this window is meant to start playing.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceUrl) return;
    const shouldStart = shouldAutoStartRef.current;
    shouldAutoStartRef.current = false;
    if (!shouldStart) {
      setIsPlaying(false);
      return;
    }
    video
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        // Browser autoplay policies surface here; the user can press play.
        setIsPlaying(false);
      });
  }, [sourceUrl]);

  const retryVideo = () => {
    setHasVideoError(false);
    const video = videoRef.current;
    if (!video) return;
    video.load();
    video.play().catch(() => {
      // Ignore autoplay rejection; user can press play.
    });
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !sourceUrl) return;
    if (video.paused) {
      video.play().catch(() => {
        // Ignore autoplay rejection.
      });
    } else {
      video.pause();
    }
  };

  /**
   * Seeks to a file-relative position. Inside the currently buffered window
   * this is a plain `currentTime` set; anywhere else the server cannot serve
   * range requests, so a fresh bounded window opens at the target instead.
   * `buffered` is checked rather than `seekable` because the seekable range
   * over-reports for progressive fMP4 streams.
   */
  const seekTo = (targetMs: number) => {
    const video = videoRef.current;
    const { startMs, durationMs, fileDurationMs } = windowRef.current;
    if (!video || !sourceUrl || durationMs <= 0) return;

    const clamped = Math.max(
      0,
      Math.min(targetMs, Math.max(0, fileDurationMs - 500)),
    );
    const relativeMs = clamped - startMs;
    if (relativeMs >= 0 && relativeMs < durationMs) {
      const relativeSeconds = relativeMs / 1000;
      for (let index = 0; index < video.buffered.length; index += 1) {
        if (
          relativeSeconds >= video.buffered.start(index) &&
          relativeSeconds <= video.buffered.end(index) - 0.25
        ) {
          video.currentTime = relativeSeconds;
          return;
        }
      }
    }
    openWindowAt(clamped, !video.paused);
  };

  const seekRelative = (deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video || !sourceUrl) return;
    const positionMs = windowRef.current.startMs + video.currentTime * 1000;
    seekTo(positionMs + deltaSeconds * 1000);
  };

  const closePlayer = () => {
    setSelectedKey(null);
    setHasVideoError(false);
    setIsPlaying(false);
    setMeasuredDurationMs(0);
    setWindowStartMs(0);
    setWindowDurationMs(0);
  };

  const selectedIndex = selectedFile
    ? filesResult.files.findIndex(
        (file) => recordedFileKey(file) === selectedKey,
      )
    : -1;

  return (
    <div className={styles.root}>
      <PageHeader
        title="Playback"
        subtitle="Recorded stream playback on the MediaMTX server"
      />

      <div className={styles.workspace}>
        <PlaybackStreamList
          recordings={streamsCatalog.recordings}
          selectedStream={selectedStream}
          isLoading={streamsCatalog.isLoading}
          isError={streamsCatalog.isError}
          onSelect={setSelectedStream}
          onRefresh={() => void streamsCatalog.refresh()}
        />
        <PlaybackFileList
          files={filesResult.files}
          selectedKey={selectedKey}
          streamName={selectedStream}
          isLoading={filesResult.isLoading}
          isError={filesResult.isError}
          autoplayEnabled={autoplayEnabled}
          onToggleAutoplay={setAutoplayEnabled}
          onSelect={(file) => selectFile(file, true)}
          onDownload={handleDownload}
          onRetry={() => void filesResult.refresh()}
        />

        <div className={styles.stage}>
          <PlaybackViewer
            videoRef={videoRef}
            sourceUrl={sourceUrl}
            streamName={selectedStream}
            fileName={selectedFile ? recordedFileKey(selectedFile) : null}
            isBuffering={isBuffering}
            hasError={hasVideoError}
            onRetry={retryVideo}
            onClose={closePlayer}
          />
          <PlaybackSeekBar
            videoRef={videoRef}
            fullDurationMs={fullDurationMs}
            windowStartMs={windowStartMs}
            isDisabled={sourceUrl === null || hasVideoError}
            resetKey={sourceUrl}
            onSeek={seekTo}
          />
          <PlaybackToolbar
            streamName={selectedStream}
            fileStartMs={selectedFile?.startMs ?? null}
            isDisabled={sourceUrl === null || hasVideoError}
            isPlaying={isPlaying}
            hasPreviousFile={selectedIndex > 0}
            hasNextFile={
              selectedIndex >= 0 && selectedIndex < filesResult.files.length - 1
            }
            rate={rate}
            onTogglePlay={togglePlay}
            onSeekRelative={seekRelative}
            onPreviousFile={() => advanceFile(-1)}
            onNextFile={() => advanceFile(1)}
            onRateChange={setRate}
          />
        </div>
      </div>

      <div className={styles.noticeStack}>
        {endpoint.status === "disabled" && (
          <MessageBar intent="warning" className={styles.notice}>
            <MessageBarBody>
              The playback server is disabled in the MediaMTX configuration.
            </MessageBarBody>
          </MessageBar>
        )}
        {endpoint.status === "invalid" && (
          <MessageBar intent="error" className={styles.notice}>
            <MessageBarBody>
              The playback server endpoint could not be derived. Configure it in
              the navigation settings.
            </MessageBarBody>
          </MessageBar>
        )}
      </div>
    </div>
  );
}
