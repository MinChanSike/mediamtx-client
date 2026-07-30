import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import useAppStore from '@src/store/useAppStore';
import { useMediaMTXConfig } from '@src/hooks/useMediaMTXConfig';
import Hls from 'hls.js';

export type PlaybackMode = 'webrtc' | 'hls' | 'error';
export type PlaybackStatus = 'idle' | 'connecting' | 'playing' | 'error';

function extractPlaybackPort(address: string | undefined, fallback: string) {
  const match = address?.match(/:(\d+)$/);
  return match ? match[1] : fallback;
}

function parsePlaybackServerUrl(serverUrl: string) {
  try {
    const url = new URL(serverUrl);
    return {
      hostname: url.hostname,
      protocol: url.protocol,
    };
  } catch {
    return {
      hostname: 'localhost',
      protocol: 'http:',
    };
  }
}

export function useStreamPlayer(streamName: string | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { data: config } = useMediaMTXConfig();
  const serverUrl = useAppStore((s) => s.serverUrl);

  const [mode, setMode] = useState<PlaybackMode>('webrtc');
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const connectionTimeoutRef = useRef<number | null>(null);
  const webrtcPort = useMemo(
    () => extractPlaybackPort(config?.webrtcAddress, '8889'),
    [config?.webrtcAddress]
  );
  const hlsPort = useMemo(
    () => extractPlaybackPort(config?.hlsAddress, '8888'),
    [config?.hlsAddress]
  );
  const playbackServer = useMemo(() => parsePlaybackServerUrl(serverUrl), [serverUrl]);

  // Clean up any active connections
  const cleanup = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
  }, []);

  const getUrls = useCallback(() => {
    if (!streamName) return { whepUrl: '', hlsUrl: '' };

    const whepUrl = `${playbackServer.protocol}//${playbackServer.hostname}:${webrtcPort}/${streamName}/whep`;
    const hlsUrl = `${playbackServer.protocol}//${playbackServer.hostname}:${hlsPort}/${streamName}/index.m3u8`;

    return { whepUrl, hlsUrl };
  }, [streamName, playbackServer.hostname, playbackServer.protocol, webrtcPort, hlsPort]);

  const startHls = useCallback((hlsUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    cleanup();
    setMode('hls');
    setStatus('connecting');
    setErrorMessage(null);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari / iOS)
      video.src = hlsUrl;
      const onMetadataLoaded = () => {
        video.play()
          .then(() => {
            setStatus('playing');
            setIsPlaying(true);
          })
          .catch((err) => {
            setStatus('error');
            setErrorMessage(`Native HLS play failed: ${err.message}`);
          });
      };
      video.addEventListener('loadedmetadata', onMetadataLoaded);
      video.addEventListener('error', () => {
        setStatus('error');
        setErrorMessage('Native HLS play error');
      });
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 10,
        enableWorker: true,
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play()
          .then(() => {
            setStatus('playing');
            setIsPlaying(true);
          })
          .catch((err) => {
            setStatus('error');
            setErrorMessage(`HLS.js play failed: ${err.message}`);
          });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStatus('error');
          setErrorMessage(`HLS.js error: ${data.details}`);
        }
      });
    } else {
      setStatus('error');
      setErrorMessage('HLS is not supported in this browser');
    }
  }, [cleanup]);

  const startWebRtc = useCallback(async (whepUrl: string, hlsUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    cleanup();
    setMode('webrtc');
    setStatus('connecting');
    setErrorMessage(null);

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Add transceivers for receive-only audio/video
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          // Clear connection timeout since track is received
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          videoRef.current.play()
            .then(() => {
              setStatus('playing');
              setIsPlaying(true);
            })
            .catch((err) => {
              console.warn('WebRTC autoplay block:', err);
              setStatus('playing');
              setIsPlaying(true);
            });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          console.warn('WebRTC connection failed, falling back to HLS');
          startHls(hlsUrl);
        } else if (pc.connectionState === 'connected') {
          setStatus('playing');
          setIsPlaying(true);
        }
      };

      // Set connection timeout (5 seconds)
      connectionTimeoutRef.current = window.setTimeout(() => {
        console.warn('WebRTC connection timed out, falling back to HLS');
        startHls(hlsUrl);
      }, 5000);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHEP server returned status ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp: answerSdp,
        })
      );
    } catch (err) {
      console.warn('WebRTC initialization failed, falling back to HLS:', err);
      startHls(hlsUrl);
    }
  }, [cleanup, startHls]);

  const loadStream = useCallback(() => {
    if (!streamName) {
      cleanup();
      setStatus('idle');
      return;
    }

    const { whepUrl, hlsUrl } = getUrls();
    startWebRtc(whepUrl, hlsUrl);
  }, [streamName, getUrls, startWebRtc, cleanup]);

  // Effect to load stream when name changes
  useEffect(() => {
    loadStream();
    return () => {
      cleanup();
    };
  }, [streamName, loadStream, cleanup]);

  const play = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('Play failed:', err));
    }
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const nextMute = !videoRef.current.muted;
      videoRef.current.muted = nextMute;
      setIsMuted(nextMute);
    }
  }, []);

  const changeVolume = useCallback((value: number) => {
    if (videoRef.current) {
      videoRef.current.volume = value;
      videoRef.current.muted = value === 0;
      setIsMuted(value === 0);
    }
  }, []);

  const retry = useCallback(() => {
    loadStream();
  }, [loadStream]);

  return {
    videoRef,
    mode,
    status,
    errorMessage,
    isPlaying,
    isMuted,
    play,
    pause,
    toggleMute,
    changeVolume,
    retry,
    urls: getUrls(),
  };
}
