import { create } from 'zustand';
import type { ServerInfo } from '@src/api/serverInfoApi';
import type { PathList } from '@src/schemas/pathSchema';
import type { CompleteServerConfig, GlobalConfig } from '@src/types/config';

export type ApiMutationKey = 'addStream' | 'editStream' | 'deleteStream' | 'kickStreamTarget';

export interface ApiResourceState<T> {
  data: T | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  lastLoadedAt: number | null;
}

export interface ApiMutationState {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: Error | null;
}

interface MediaMTXApiState {
  serverUrl: string;
  paths: ApiResourceState<PathList>;
  serverInfo: ApiResourceState<ServerInfo>;
  globalConfig: ApiResourceState<GlobalConfig>;
  rawConfig: ApiResourceState<CompleteServerConfig>;
  pathDetails: Record<string, ApiResourceState<unknown>>;
  viewerDetails: Record<string, ApiResourceState<unknown>>;
  mutations: Record<ApiMutationKey, ApiMutationState>;
  resetForServerUrl: (serverUrl: string) => void;
  beginPathsLoad: () => void;
  setPathsSuccess: (data: PathList) => void;
  setPathsError: (error: Error) => void;
  beginServerInfoLoad: () => void;
  setServerInfoSuccess: (data: ServerInfo) => void;
  setServerInfoError: (error: Error) => void;
  beginGlobalConfigLoad: () => void;
  setGlobalConfigSuccess: (data: GlobalConfig) => void;
  setGlobalConfigError: (error: Error) => void;
  beginRawConfigLoad: () => void;
  setRawConfigSuccess: (data: CompleteServerConfig) => void;
  setRawConfigError: (error: Error) => void;
  beginPathDetailLoad: (name: string) => void;
  setPathDetailSuccess: (name: string, data: unknown) => void;
  setPathDetailError: (name: string, error: Error) => void;
  beginViewerDetailLoad: (key: string) => void;
  setViewerDetailSuccess: (key: string, data: unknown) => void;
  setViewerDetailError: (key: string, error: Error) => void;
  beginMutation: (key: ApiMutationKey) => void;
  setMutationSuccess: (key: ApiMutationKey) => void;
  setMutationError: (key: ApiMutationKey, error: Error) => void;
  resetMutation: (key: ApiMutationKey) => void;
}

function emptyResource<T>(): ApiResourceState<T> {
  return {
    data: undefined,
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastLoadedAt: null,
  };
}

function emptyMutation(): ApiMutationState {
  return {
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  };
}

function beginResourceLoad<T>(resource: ApiResourceState<T>): ApiResourceState<T> {
  return {
    ...resource,
    isLoading: resource.data === undefined,
    isRefreshing: resource.data !== undefined,
    error: null,
  };
}

function beginResourceLoadPreservingError<T>(resource: ApiResourceState<T>): ApiResourceState<T> {
  return {
    ...resource,
    isLoading: resource.data === undefined,
    isRefreshing: resource.data !== undefined,
  };
}

function resourceSuccess<T>(data: T): ApiResourceState<T> {
  return {
    data,
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastLoadedAt: Date.now(),
  };
}

function resourceError<T>(resource: ApiResourceState<T>, error: Error): ApiResourceState<T> {
  return {
    ...resource,
    isLoading: false,
    isRefreshing: false,
    error,
  };
}

function initialMutations(): Record<ApiMutationKey, ApiMutationState> {
  return {
    addStream: emptyMutation(),
    editStream: emptyMutation(),
    deleteStream: emptyMutation(),
    kickStreamTarget: emptyMutation(),
  };
}

const useMediaMTXApiStore = create<MediaMTXApiState>((set) => ({
  serverUrl: '',
  paths: emptyResource<PathList>(),
  serverInfo: emptyResource<ServerInfo>(),
  globalConfig: emptyResource<GlobalConfig>(),
  rawConfig: emptyResource<CompleteServerConfig>(),
  pathDetails: {},
  viewerDetails: {},
  mutations: initialMutations(),
  resetForServerUrl: (serverUrl) =>
    set((state) => {
      if (state.serverUrl === serverUrl) return state;

      return {
        serverUrl,
        paths: emptyResource<PathList>(),
        serverInfo: emptyResource<ServerInfo>(),
        globalConfig: emptyResource<GlobalConfig>(),
        rawConfig: emptyResource<CompleteServerConfig>(),
        pathDetails: {},
        viewerDetails: {},
        mutations: initialMutations(),
      };
    }),
  beginPathsLoad: () =>
    set((state) => ({ paths: beginResourceLoadPreservingError(state.paths) })),
  setPathsSuccess: (data) => set({ paths: resourceSuccess(data) }),
  setPathsError: (error) => set((state) => ({ paths: resourceError(state.paths, error) })),
  beginServerInfoLoad: () =>
    set((state) => ({ serverInfo: beginResourceLoad(state.serverInfo) })),
  setServerInfoSuccess: (data) => set({ serverInfo: resourceSuccess(data) }),
  setServerInfoError: (error) =>
    set((state) => ({ serverInfo: resourceError(state.serverInfo, error) })),
  beginGlobalConfigLoad: () =>
    set((state) => ({ globalConfig: beginResourceLoadPreservingError(state.globalConfig) })),
  setGlobalConfigSuccess: (data) => set({ globalConfig: resourceSuccess(data) }),
  setGlobalConfigError: (error) =>
    set((state) => ({ globalConfig: resourceError(state.globalConfig, error) })),
  beginRawConfigLoad: () => set((state) => ({ rawConfig: beginResourceLoad(state.rawConfig) })),
  setRawConfigSuccess: (data) => set({ rawConfig: resourceSuccess(data) }),
  setRawConfigError: (error) =>
    set((state) => ({ rawConfig: resourceError(state.rawConfig, error) })),
  beginPathDetailLoad: (name) =>
    set((state) => ({
      pathDetails: {
        ...state.pathDetails,
        [name]: beginResourceLoad(state.pathDetails[name] ?? emptyResource<unknown>()),
      },
    })),
  setPathDetailSuccess: (name, data) =>
    set((state) => ({
      pathDetails: {
        ...state.pathDetails,
        [name]: resourceSuccess(data),
      },
    })),
  setPathDetailError: (name, error) =>
    set((state) => ({
      pathDetails: {
        ...state.pathDetails,
        [name]: resourceError(state.pathDetails[name] ?? emptyResource<unknown>(), error),
      },
    })),
  beginViewerDetailLoad: (key) =>
    set((state) => ({
      viewerDetails: {
        ...state.viewerDetails,
        [key]: beginResourceLoad(state.viewerDetails[key] ?? emptyResource<unknown>()),
      },
    })),
  setViewerDetailSuccess: (key, data) =>
    set((state) => ({
      viewerDetails: {
        ...state.viewerDetails,
        [key]: resourceSuccess(data),
      },
    })),
  setViewerDetailError: (key, error) =>
    set((state) => ({
      viewerDetails: {
        ...state.viewerDetails,
        [key]: resourceError(state.viewerDetails[key] ?? emptyResource<unknown>(), error),
      },
    })),
  beginMutation: (key) =>
    set((state) => ({
      mutations: {
        ...state.mutations,
        [key]: {
          isPending: true,
          isError: false,
          isSuccess: false,
          error: null,
        },
      },
    })),
  setMutationSuccess: (key) =>
    set((state) => ({
      mutations: {
        ...state.mutations,
        [key]: {
          isPending: false,
          isError: false,
          isSuccess: true,
          error: null,
        },
      },
    })),
  setMutationError: (key, error) =>
    set((state) => ({
      mutations: {
        ...state.mutations,
        [key]: {
          isPending: false,
          isError: true,
          isSuccess: false,
          error,
        },
      },
    })),
  resetMutation: (key) =>
    set((state) => ({
      mutations: {
        ...state.mutations,
        [key]: emptyMutation(),
      },
    })),
}));

export default useMediaMTXApiStore;
