import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import useMediaMTXApiStore from '@src/store/useMediaMTXApiStore';

type ActiveTab = 'dashboard' | 'streams';
type Theme = 'light' | 'dark';

export interface AppState {
  activeTab: ActiveTab;
  theme: Theme;
  serverUrl: string;
  isSidebarCollapsed: boolean;
  setActiveTab: (tab: ActiveTab) => void;
  setTheme: (theme: Theme) => void;
  setServerUrl: (url: string) => void;
  toggleSidebar: () => void;
}

interface AppPreferences {
  theme: Theme;
  serverUrl: string;
}

export const APP_PREFERENCES_STORAGE_KEY = 'mediamtx-app-preferences';

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      // Preferences remain usable in memory when browser storage is unavailable.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // Preferences remain usable in memory when browser storage is unavailable.
    }
  },
};

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function mergeAppPreferences(persistedState: unknown, currentState: AppState): AppState {
  if (!persistedState || typeof persistedState !== 'object') return currentState;

  const persisted = persistedState as Partial<AppPreferences>;
  return {
    ...currentState,
    theme: isTheme(persisted.theme) ? persisted.theme : currentState.theme,
    serverUrl:
      typeof persisted.serverUrl === 'string' && persisted.serverUrl.trim().length > 0
        ? persisted.serverUrl
        : currentState.serverUrl,
  };
}

export function createAppStore(storage: StateStorage = safeLocalStorage) {
  return create<AppState>()(
    persist(
      (set) => ({
        activeTab: 'dashboard',
        theme: 'dark',
        serverUrl: 'http://localhost:9997',
        isSidebarCollapsed: false,
        setActiveTab: (tab) => set({ activeTab: tab }),
        setTheme: (theme) => set({ theme }),
        setServerUrl: (url) => {
          useMediaMTXApiStore.getState().resetForServerUrl(url);
          set({ serverUrl: url });
        },
        toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      }),
      {
        name: APP_PREFERENCES_STORAGE_KEY,
        storage: createJSONStorage<AppPreferences>(() => storage),
        partialize: (state) => ({
          theme: state.theme,
          serverUrl: state.serverUrl,
        }),
        merge: mergeAppPreferences,
      }
    )
  );
}

const useAppStore = createAppStore();

export default useAppStore;
