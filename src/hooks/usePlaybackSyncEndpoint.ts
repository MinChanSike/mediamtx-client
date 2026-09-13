import { useMemo } from 'react';
import { derivePlaybackBaseUrl } from '@src/api/playbackSyncApi';
import { useStoreBackedGlobalConfig } from '@src/hooks/useMediaMTXApi';
import useAppStore from '@src/store/useAppStore';
import usePlaybackSyncStore from '@src/store/usePlaybackSyncStore';

export type PlaybackSyncEndpointStatus = 'loading' | 'ready' | 'disabled' | 'invalid';

export interface PlaybackSyncEndpoint {
  status: PlaybackSyncEndpointStatus;
  /** Resolved base URL once ready; null otherwise. */
  baseUrl: string | null;
  /** Base URL derived from config, even when an override is active. */
  derivedBaseUrl: string | null;
  isOverride: boolean;
}

/**
 * Resolves the playback server base URL for the current API server: a
 * user-editable override persisted per API server wins, otherwise the URL is
 * derived from the API hostname, `playbackAddress`, and `playbackEncryption`.
 */
export function usePlaybackSyncEndpoint(): PlaybackSyncEndpoint {
  const serverUrl = useAppStore((s) => s.serverUrl);
  const endpointOverrides = usePlaybackSyncStore((s) => s.endpointOverrides);
  const { data: config, isLoading } = useStoreBackedGlobalConfig();

  return useMemo(() => {
    const override = endpointOverrides[serverUrl];
    const derivedBaseUrl = derivePlaybackBaseUrl(serverUrl, config ?? {});

    if (config && config.playback === false) {
      return { status: 'disabled', baseUrl: null, derivedBaseUrl, isOverride: false };
    }

    if (override) {
      return { status: 'ready', baseUrl: override, derivedBaseUrl, isOverride: true };
    }

    if (isLoading && !config) {
      return { status: 'loading', baseUrl: null, derivedBaseUrl, isOverride: false };
    }

    if (!derivedBaseUrl) {
      return { status: 'invalid', baseUrl: null, derivedBaseUrl: null, isOverride: false };
    }

    return { status: 'ready', baseUrl: derivedBaseUrl, derivedBaseUrl, isOverride: false };
  }, [serverUrl, endpointOverrides, config, isLoading]);
}
