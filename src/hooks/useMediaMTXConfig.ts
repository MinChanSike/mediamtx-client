import {
  useStoreBackedGlobalConfig,
  useStoreBackedRawConfig,
} from '@src/hooks/useMediaMTXApi';

export function useMediaMTXConfig(enabled = true) {
  return useStoreBackedGlobalConfig(enabled);
}

export function useMediaMTXRawConfig(enabled = true) {
  return useStoreBackedRawConfig(enabled);
}
