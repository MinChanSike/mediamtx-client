import { apiFetch, ApiError } from '@src/api/client';
import useAppStore from '@src/store/useAppStore';
import type { PathList, PathItem, Track, Reader } from '@src/schemas/pathSchema';
import type { KickTarget, ViewerDetailTarget } from '@src/utils/streamDisplay';

interface RawPathItem {
  name: string;
  source: Record<string, unknown> | string | null;
  sourceState?: string;
  sourceError: string;
  online?: boolean;
  available?: boolean;
  ready?: boolean;
  tracks: Track[];
  bytesReceived: number;
  bytesSent: number;
  inboundBytes?: number;
  outboundBytes?: number;
  totalBytesReceived?: number;
  totalBytesSent?: number;
  readers: Reader[];
  [key: string]: unknown;
}

interface RawPathList {
  itemCount: number;
  pageCount: number;
  items: RawPathItem[];
}

interface RawConfigPathItem {
  name: string;
  source?: unknown;
  [key: string]: unknown;
}

interface RawConfigPathList {
  itemCount: number;
  pageCount: number;
  items: RawConfigPathItem[];
}

const FALLBACK_CONFIG_PATH_NAME = '**all_others';

function mapRuntimePath(item: RawPathItem): PathItem {
  let sourceString: string | null = null;
  const sourceInfo = item.source && typeof item.source === 'object' ? item.source : null;

  if (typeof item.source === 'string') {
    sourceString = item.source;
  } else if (item.source && typeof item.source === 'object') {
    const sourceUrl = item.source.url;
    sourceString = typeof sourceUrl === 'string' && sourceUrl ? sourceUrl : null;
  }

  return {
    ...item,
    source: sourceString,
    sourceInfo,
  };
}

export async function getPathsList(serverUrl?: string): Promise<PathList> {
  const [runtimePaths, configPaths] = await Promise.all([
    apiFetch<RawPathList>('/v3/paths/list', undefined, serverUrl),
    apiFetch<RawConfigPathList>('/v3/config/paths/list', undefined, serverUrl),
  ]);

  const configPathsByName = new Map(
    (configPaths.items || [])
      .filter((item) => item.name !== FALLBACK_CONFIG_PATH_NAME)
      .map((item) => [item.name, item])
  );

  const mergedItems: PathItem[] = (runtimePaths.items || [])
    .filter((item) => item.name !== FALLBACK_CONFIG_PATH_NAME)
    .map((item: RawPathItem) => {
      const runtimePath = mapRuntimePath(item);
      const configuredPath = configPathsByName.get(item.name);

      if (!configuredPath) return runtimePath;

      const configuredSource =
        typeof configuredPath.source === 'string' ? configuredPath.source : runtimePath.source;

      return {
        ...configuredPath,
        ...runtimePath,
        source: configuredSource,
        sourceInfo: runtimePath.sourceInfo,
        isConfigured: true,
      };
    });

  return {
    itemCount: runtimePaths.itemCount || mergedItems.length,
    pageCount: runtimePaths.pageCount || 1,
    items: mergedItems,
  };
}

export async function getPathDetail(name: string, serverUrl?: string): Promise<unknown> {
  return apiFetch<unknown>(`/v3/paths/get/${encodeURIComponent(name)}`, undefined, serverUrl);
}

export async function getViewerDetail(
  target: ViewerDetailTarget,
  serverUrl?: string
): Promise<unknown> {
  return apiFetch<unknown>(
    `/v3/${target.endpoint}/get/${encodeURIComponent(target.id)}`,
    undefined,
    serverUrl
  );
}

export async function addPath(name: string, sourceUri: string): Promise<void> {
  const baseUrl = useAppStore.getState().serverUrl;
  const url = `${baseUrl}/v3/config/paths/add/${encodeURIComponent(name)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source: sourceUri }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }
}

export async function deletePath(name: string): Promise<void> {
  const baseUrl = useAppStore.getState().serverUrl;
  const url = `${baseUrl}/v3/config/paths/delete/${encodeURIComponent(name)}`;

  const response = await fetch(url, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }
}

export async function patchPath(name: string, sourceUri: string): Promise<void> {
  const baseUrl = useAppStore.getState().serverUrl;
  const url = `${baseUrl}/v3/config/paths/patch/${encodeURIComponent(name)}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source: sourceUri }),
  });

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }
}

export async function kickPathTarget(target: KickTarget): Promise<void> {
  const baseUrl = useAppStore.getState().serverUrl;
  const url = `${baseUrl}/v3/${target.endpoint}/kick/${encodeURIComponent(target.id)}`;

  const response = await fetch(url, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }
}
