import { useEffect, useMemo } from 'react';
import useSWR, { mutate as mutateSWR } from 'swr';
import { getCompleteServerConfig, getGlobalConfig } from '@src/api/configApi';
import { getServerInfo, type ServerInfo } from '@src/api/serverInfoApi';
import {
  addPath,
  deletePath,
  getPathDetail,
  getPathsList,
  getViewerDetail,
  kickPathTarget,
  patchPath,
} from '@src/api/pathsApi';
import useAppStore from '@src/store/useAppStore';
import useMediaMTXApiStore, {
  type ApiMutationKey,
  type ApiMutationState,
  type ApiResourceState,
} from '@src/store/useMediaMTXApiStore';
import type { AddStreamInput } from '@src/hooks/useAddStream';
import type { PathList } from '@src/schemas/pathSchema';
import type { CompleteServerConfig, GlobalConfig } from '@src/types/config';
import type { KickTarget, ViewerDetailTarget } from '@src/utils/streamDisplay';

const LIVE_REFRESH_MS = 3000;
const SWR_CACHE_PREFIX = 'mediamtx-api';

type ResourceResult<T> = {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<void>;
};

type MutationOptions = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
};

type StoreMutationResult<TVariables> = ApiMutationState & {
  mutate: (variables: TVariables, options?: MutationOptions) => void;
  mutateAsync: (variables: TVariables, options?: MutationOptions) => Promise<void>;
  reset: () => void;
};

type SwrResource =
  | 'paths'
  | 'serverInfo'
  | 'globalConfig'
  | 'rawConfig'
  | 'pathDetail'
  | 'viewerDetail';

type MediaMTXSWRKey = readonly [typeof SWR_CACHE_PREFIX, SwrResource, string, string?];

const swrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  refreshWhenHidden: true,
  refreshWhenOffline: true,
  shouldRetryOnError: false,
};

const resourceGenerations = new Map<string, number>();

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function ensureApiStoreServerUrl(serverUrl: string) {
  useMediaMTXApiStore.getState().resetForServerUrl(serverUrl);
}

function canCommit(serverUrl: string) {
  return useAppStore.getState().serverUrl === serverUrl;
}

function makeToken() {
  return { loadedAt: Date.now() };
}

function getCurrentServerUrl() {
  return useAppStore.getState().serverUrl;
}

function pathsKey(serverUrl = getCurrentServerUrl()): MediaMTXSWRKey {
  return [SWR_CACHE_PREFIX, 'paths', serverUrl];
}

function serverInfoKey(serverUrl = getCurrentServerUrl()): MediaMTXSWRKey {
  return [SWR_CACHE_PREFIX, 'serverInfo', serverUrl];
}

function globalConfigKey(serverUrl = getCurrentServerUrl()): MediaMTXSWRKey {
  return [SWR_CACHE_PREFIX, 'globalConfig', serverUrl];
}

function rawConfigKey(serverUrl = getCurrentServerUrl()): MediaMTXSWRKey {
  return [SWR_CACHE_PREFIX, 'rawConfig', serverUrl];
}

function pathDetailKey(name: string, serverUrl = getCurrentServerUrl()): MediaMTXSWRKey {
  return [SWR_CACHE_PREFIX, 'pathDetail', serverUrl, name];
}

function viewerDetailCacheKey(target: ViewerDetailTarget, serverUrl = getCurrentServerUrl()) {
  return [SWR_CACHE_PREFIX, 'viewerDetail', serverUrl, getViewerDetailKey(target)] as const;
}

function resourceGenerationKey(key: MediaMTXSWRKey) {
  return key.join('\u0000');
}

function beginResourceGeneration(key: MediaMTXSWRKey) {
  const generationKey = resourceGenerationKey(key);
  const generation = (resourceGenerations.get(generationKey) ?? 0) + 1;
  resourceGenerations.set(generationKey, generation);
  return { generationKey, generation };
}

function canCommitGeneration(serverUrl: string, generationKey: string, generation: number) {
  return canCommit(serverUrl) && resourceGenerations.get(generationKey) === generation;
}

function beginIfCurrent(serverUrl: string, begin: () => void) {
  if (!canCommit(serverUrl)) return false;

  ensureApiStoreServerUrl(serverUrl);
  begin();
  return true;
}

async function loadPaths(serverUrl: string) {
  const { generationKey, generation } = beginResourceGeneration(pathsKey(serverUrl));

  if (!beginIfCurrent(serverUrl, () => useMediaMTXApiStore.getState().beginPathsLoad())) {
    return makeToken();
  }

  try {
    const data = await getPathsList(serverUrl);
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setPathsSuccess(data);
    }
  } catch (error) {
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setPathsError(toError(error));
    }
  }

  return makeToken();
}

async function loadServerInfo(serverUrl: string) {
  const { generationKey, generation } = beginResourceGeneration(serverInfoKey(serverUrl));

  if (!beginIfCurrent(serverUrl, () => useMediaMTXApiStore.getState().beginServerInfoLoad())) {
    return makeToken();
  }

  try {
    const data = await getServerInfo(serverUrl);
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setServerInfoSuccess(data);
    }
  } catch (error) {
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setServerInfoError(toError(error));
    }
  }

  return makeToken();
}

async function loadGlobalConfig(serverUrl: string) {
  const { generationKey, generation } = beginResourceGeneration(globalConfigKey(serverUrl));

  if (!beginIfCurrent(serverUrl, () => useMediaMTXApiStore.getState().beginGlobalConfigLoad())) {
    return makeToken();
  }

  try {
    const data = await getGlobalConfig(serverUrl);
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setGlobalConfigSuccess(data);
    }
  } catch (error) {
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setGlobalConfigError(toError(error));
    }
  }

  return makeToken();
}

async function loadRawConfig(serverUrl: string) {
  const { generationKey, generation } = beginResourceGeneration(rawConfigKey(serverUrl));

  if (!beginIfCurrent(serverUrl, () => useMediaMTXApiStore.getState().beginRawConfigLoad())) {
    return makeToken();
  }

  try {
    const data = await getCompleteServerConfig(serverUrl);
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setRawConfigSuccess(data);
    }
  } catch (error) {
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setRawConfigError(toError(error));
    }
  }

  return makeToken();
}

async function loadPathDetail(serverUrl: string, name: string) {
  const { generationKey, generation } = beginResourceGeneration(pathDetailKey(name, serverUrl));

  if (!beginIfCurrent(serverUrl, () => useMediaMTXApiStore.getState().beginPathDetailLoad(name))) {
    return makeToken();
  }

  try {
    const data = await getPathDetail(name, serverUrl);
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setPathDetailSuccess(name, data);
    }
  } catch (error) {
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setPathDetailError(name, toError(error));
    }
  }

  return makeToken();
}

async function loadViewerDetail(serverUrl: string, target: ViewerDetailTarget) {
  const { generationKey, generation } = beginResourceGeneration(
    viewerDetailCacheKey(target, serverUrl)
  );
  const key = getViewerDetailKey(target);
  if (!beginIfCurrent(serverUrl, () => useMediaMTXApiStore.getState().beginViewerDetailLoad(key))) {
    return makeToken();
  }

  try {
    const data = await getViewerDetail(target, serverUrl);
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setViewerDetailSuccess(key, data);
    }
  } catch (error) {
    if (canCommitGeneration(serverUrl, generationKey, generation)) {
      useMediaMTXApiStore.getState().setViewerDetailError(key, toError(error));
    }
  }

  return makeToken();
}

async function mutateResource(
  key: MediaMTXSWRKey,
  loader: () => Promise<{ loadedAt: number }>
): Promise<void> {
  await mutateSWR(key, loader, {
    populateCache: true,
    revalidate: false,
    throwOnError: false,
  });
}

function makeResourceResult<T>(
  resource: ApiResourceState<T>,
  enabled: boolean,
  refetch: () => Promise<void>
): ResourceResult<T> {
  const isInitialPending = enabled && resource.data === undefined && !resource.error;
  const isLoading = resource.isLoading || isInitialPending;

  return {
    data: resource.data,
    error: resource.error,
    isLoading,
    isPending: isLoading,
    isFetching: resource.isRefreshing || isLoading,
    isError: !!resource.error,
    isSuccess: resource.data !== undefined && !resource.error,
    refetch,
  };
}

function useApiStoreServerUrl() {
  const serverUrl = useAppStore((s) => s.serverUrl);

  useEffect(() => {
    ensureApiStoreServerUrl(serverUrl);
  }, [serverUrl]);

  return serverUrl;
}

async function refreshLoadedConfigAfterMutation() {
  const state = useMediaMTXApiStore.getState();
  const refreshes: Array<Promise<void>> = [];

  if (state.paths.data || state.paths.isLoading || state.paths.isRefreshing || state.paths.error) {
    refreshes.push(refreshPathsNow());
  }
  if (
    state.globalConfig.data ||
    state.globalConfig.isLoading ||
    state.globalConfig.isRefreshing ||
    state.globalConfig.error
  ) {
    refreshes.push(refreshGlobalConfigNow());
  }
  if (
    state.rawConfig.data ||
    state.rawConfig.isLoading ||
    state.rawConfig.isRefreshing ||
    state.rawConfig.error
  ) {
    refreshes.push(refreshRawConfigNow());
  }

  await Promise.all(refreshes);
}

async function refreshPathsAfterMutation() {
  const state = useMediaMTXApiStore.getState();
  if (state.paths.data || state.paths.isLoading || state.paths.isRefreshing || state.paths.error) {
    await refreshPathsNow();
  }
}

export async function refreshPathsNow(): Promise<void> {
  const serverUrl = getCurrentServerUrl();
  await mutateResource(pathsKey(serverUrl), () => loadPaths(serverUrl));
}

export async function refreshServerInfoNow(): Promise<void> {
  const serverUrl = getCurrentServerUrl();
  await mutateResource(serverInfoKey(serverUrl), () => loadServerInfo(serverUrl));
}

export async function refreshGlobalConfigNow(): Promise<void> {
  const serverUrl = getCurrentServerUrl();
  await mutateResource(globalConfigKey(serverUrl), () => loadGlobalConfig(serverUrl));
}

export async function refreshRawConfigNow(): Promise<void> {
  const serverUrl = getCurrentServerUrl();
  await mutateResource(rawConfigKey(serverUrl), () => loadRawConfig(serverUrl));
}

export async function refreshPathDetailNow(name: string): Promise<void> {
  const serverUrl = getCurrentServerUrl();
  await mutateResource(pathDetailKey(name, serverUrl), () => loadPathDetail(serverUrl, name));
}

export function getViewerDetailKey(target: ViewerDetailTarget) {
  return `${target.endpoint}:${target.id}`;
}

export async function refreshViewerDetailNow(target: ViewerDetailTarget): Promise<void> {
  const serverUrl = getCurrentServerUrl();
  await mutateResource(viewerDetailCacheKey(target, serverUrl), () =>
    loadViewerDetail(serverUrl, target)
  );
}

export function mountPathsConsumer() {
  return () => undefined;
}

export function mountServerInfoConsumer() {
  return () => undefined;
}

export function mountGlobalConfigConsumer() {
  return () => undefined;
}

export function useStoreBackedPaths(): ResourceResult<PathList> {
  const resource = useMediaMTXApiStore((state) => state.paths);
  const serverUrl = useApiStoreServerUrl();

  useSWR(pathsKey(serverUrl), () => loadPaths(serverUrl), {
    ...swrOptions,
    refreshInterval: LIVE_REFRESH_MS,
  });

  return makeResourceResult(resource, true, refreshPathsNow);
}

export function useStoreBackedServerInfo(): ResourceResult<ServerInfo> {
  const resource = useMediaMTXApiStore((state) => state.serverInfo);
  const serverUrl = useApiStoreServerUrl();

  useSWR(serverInfoKey(serverUrl), () => loadServerInfo(serverUrl), {
    ...swrOptions,
    refreshInterval: LIVE_REFRESH_MS,
  });

  return makeResourceResult(resource, true, refreshServerInfoNow);
}

export function useStoreBackedGlobalConfig(enabled = true): ResourceResult<GlobalConfig> {
  const resource = useMediaMTXApiStore((state) => state.globalConfig);
  const serverUrl = useApiStoreServerUrl();

  useSWR(enabled ? globalConfigKey(serverUrl) : null, () => loadGlobalConfig(serverUrl), {
    ...swrOptions,
    refreshInterval: LIVE_REFRESH_MS,
  });

  return makeResourceResult(resource, enabled, refreshGlobalConfigNow);
}

export function useStoreBackedRawConfig(enabled = true): ResourceResult<CompleteServerConfig> {
  const resource = useMediaMTXApiStore((state) => state.rawConfig);
  const serverUrl = useApiStoreServerUrl();

  useSWR(enabled ? rawConfigKey(serverUrl) : null, () => loadRawConfig(serverUrl), swrOptions);

  return makeResourceResult(resource, enabled, refreshRawConfigNow);
}

export function useStoreBackedPathDetail(
  name: string | null | undefined,
  enabled: boolean
): ResourceResult<unknown> {
  const resource = useMediaMTXApiStore((state) => (name ? state.pathDetails[name] : undefined));
  const fallback = useMemo(() => {
    return {
      data: undefined,
      isLoading: false,
      isRefreshing: false,
      error: null,
      lastLoadedAt: null,
    };
  }, []);
  const serverUrl = useApiStoreServerUrl();

  useSWR(
    enabled && name ? pathDetailKey(name, serverUrl) : null,
    () => loadPathDetail(serverUrl, name as string),
    swrOptions
  );

  return makeResourceResult(resource ?? fallback, enabled && !!name, () =>
    name ? refreshPathDetailNow(name) : Promise.resolve()
  );
}

export function useStoreBackedViewerDetail(
  target: ViewerDetailTarget | null,
  enabled: boolean
): ResourceResult<unknown> {
  const key = target ? getViewerDetailKey(target) : null;
  const resource = useMediaMTXApiStore((state) => (key ? state.viewerDetails[key] : undefined));
  const fallback = useMemo(() => {
    return {
      data: undefined,
      isLoading: false,
      isRefreshing: false,
      error: null,
      lastLoadedAt: null,
    };
  }, []);
  const serverUrl = useApiStoreServerUrl();

  useSWR(
    enabled && target ? viewerDetailCacheKey(target, serverUrl) : null,
    () => loadViewerDetail(serverUrl, target as ViewerDetailTarget),
    swrOptions
  );

  return makeResourceResult(resource ?? fallback, enabled && !!target, () =>
    target ? refreshViewerDetailNow(target) : Promise.resolve()
  );
}

export async function runAddStreamMutation(input: AddStreamInput): Promise<void> {
  await addPath(input.pathName, input.sourceUri);
  await refreshLoadedConfigAfterMutation();
}

export async function runEditStreamMutation(input: {
  pathName: string;
  sourceUri: string;
}): Promise<void> {
  await patchPath(input.pathName, input.sourceUri);
  await refreshLoadedConfigAfterMutation();
}

export async function runDeleteStreamMutation(name: string): Promise<void> {
  await deletePath(name);
  await refreshLoadedConfigAfterMutation();
}

export async function runKickStreamTargetMutation(
  targetOrTargets: KickTarget | KickTarget[]
): Promise<void> {
  const targets = Array.isArray(targetOrTargets) ? targetOrTargets : [targetOrTargets];
  await Promise.all(targets.map((target) => kickPathTarget(target)));
  await refreshPathsAfterMutation();
}

export function useStoreMutation<TVariables>(
  key: ApiMutationKey,
  mutationFn: (variables: TVariables) => Promise<void>
): StoreMutationResult<TVariables> {
  const mutation = useMediaMTXApiStore((state) => state.mutations[key]);
  const beginMutation = useMediaMTXApiStore((state) => state.beginMutation);
  const setMutationSuccess = useMediaMTXApiStore((state) => state.setMutationSuccess);
  const setMutationError = useMediaMTXApiStore((state) => state.setMutationError);
  const resetMutation = useMediaMTXApiStore((state) => state.resetMutation);

  const mutateAsync = async (variables: TVariables, options?: MutationOptions) => {
    beginMutation(key);

    try {
      await mutationFn(variables);
      setMutationSuccess(key);
      options?.onSuccess?.();
    } catch (error) {
      const normalizedError = toError(error);
      setMutationError(key, normalizedError);
      options?.onError?.(normalizedError);
      throw normalizedError;
    } finally {
      options?.onSettled?.();
    }
  };

  return {
    ...mutation,
    mutate: (variables, options) => {
      void mutateAsync(variables, options).catch(() => undefined);
    },
    mutateAsync,
    reset: () => resetMutation(key),
  };
}

export function getApiIntegrationSnapshot() {
  return {
    swrCachePrefix: SWR_CACHE_PREFIX,
    liveRefreshMs: LIVE_REFRESH_MS,
    revalidateOnFocus: swrOptions.revalidateOnFocus,
    revalidateOnReconnect: swrOptions.revalidateOnReconnect,
    refreshWhenHidden: swrOptions.refreshWhenHidden,
    refreshWhenOffline: swrOptions.refreshWhenOffline,
    shouldRetryOnError: swrOptions.shouldRetryOnError,
  };
}
