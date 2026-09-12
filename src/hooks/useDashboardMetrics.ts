import { useEffect } from 'react';
import {
  useStoreBackedGlobalConfig,
  useStoreBackedPaths,
  useStoreBackedServerInfo,
} from '@src/hooks/useMediaMTXApi';
import useDashboardMetricsStore from '@src/store/useDashboardMetricsStore';
import useMediaMTXApiStore from '@src/store/useMediaMTXApiStore';
import { useTransferRates } from '@src/hooks/useTransferRates';

export function useDashboardMetrics() {
  const rates = useTransferRates();
  const ratesStatus = useMediaMTXApiStore((state) => state.ratesStatus);
  const { data: paths } = useStoreBackedPaths();
  const { data: globalConfig } = useStoreBackedGlobalConfig();
  const { data: serverInfo } = useStoreBackedServerInfo();
  const metrics = useDashboardMetricsStore((state) => state.metrics);
  const recalculate = useDashboardMetricsStore((state) => state.recalculate);

  useEffect(() => {
    recalculate({ paths, globalConfig, serverInfo, rates, ratesStatus });
  }, [globalConfig, paths, recalculate, serverInfo, rates, ratesStatus]);

  return metrics;
}
