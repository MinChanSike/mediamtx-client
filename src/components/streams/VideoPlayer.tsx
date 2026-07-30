import React, { useEffect, useRef, useState } from 'react';
import { Badge, Button, Spinner, Text } from '@fluentui/react-components';
import {
  ArrowClockwise24Regular,
  FullScreenMaximize24Regular,
  Play24Regular,
  Speaker224Regular,
  SpeakerMute24Regular,
  Warning24Regular,
} from '@fluentui/react-icons';
import { useStreamPlayer } from '@src/hooks/useStreamPlayer';

interface VideoPlayerProps {
  streamName: string | null;
  className?: string;
  fillCell?: boolean;
}

export default function VideoPlayer({
  streamName,
  className = '',
  fillCell = false,
}: VideoPlayerProps) {
  const {
    videoRef,
    mode,
    status,
    errorMessage,
    isPlaying,
    isMuted,
    play,
    toggleMute,
    changeVolume,
    retry,
  } = useStreamPlayer(streamName);

  const [volume, setVolume] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isMuted) {
      setVolume(0);
    } else {
      setVolume(videoRef.current?.volume || 0.5);
    }
  }, [isMuted, videoRef]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolume = parseFloat(event.target.value);
    setVolume(nextVolume);
    changeVolume(nextVolume);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      const container = video.parentElement;
      if (container) {
        container.requestFullscreen().catch((error) => {
          console.error('Error entering fullscreen:', error);
        });
      }
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`group relative flex w-full flex-col items-center justify-center overflow-hidden bg-black text-white ${
        fillCell ? 'h-full rounded-none' : 'aspect-video rounded-lg'
      } ${className}`}
    >
      <video
        ref={videoRef}
        playsInline
        muted={isMuted}
        className="h-full w-full object-contain"
      />

      {status === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <Spinner />
          <Text className="mt-3 text-white">
            Connecting via {mode === 'webrtc' ? 'WebRTC (WHEP)' : 'HLS fallback'}...
          </Text>
        </div>
      )}

      {(status === 'error' || !streamName) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 p-4 text-center">
          <Warning24Regular className="mb-3 text-white" />
          <Text className="text-white">
            {!streamName ? 'No stream selected' : errorMessage || 'Stream Offline or Connection Failed'}
          </Text>
          {streamName && (
            <Button
              appearance="primary"
              icon={<ArrowClockwise24Regular />}
              onClick={retry}
              className="mt-4"
            >
              Retry Connection
            </Button>
          )}
        </div>
      )}

      {streamName && (status === 'playing' || showControls) && (
        <div
          className={`absolute bottom-0 left-0 right-0 flex flex-col bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 py-1.5 transition-opacity duration-300 focus-within:opacity-100 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {!isPlaying && (
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<Play24Regular />}
                  onClick={play}
                  title="Play"
                />
              )}

              <div className="flex items-center gap-1.5">
                <Button
                  size="small"
                  appearance="subtle"
                  icon={isMuted || volume === 0 ? <SpeakerMute24Regular /> : <Speaker224Regular />}
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-16 cursor-pointer appearance-none rounded bg-white/30 accent-blue-500 hover:bg-white/40 focus:outline-none"
                  aria-label="Volume"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Badge appearance="filled">{mode === 'webrtc' ? 'RTC (WHEP)' : 'HLS'}</Badge>
              <Button
                size="small"
                appearance="subtle"
                icon={<ArrowClockwise24Regular />}
                onClick={retry}
                title="Reload Stream"
              />
              <Button
                size="small"
                appearance="subtle"
                icon={<FullScreenMaximize24Regular />}
                onClick={handleFullscreen}
                title="Fullscreen"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
