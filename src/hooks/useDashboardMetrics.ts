import { useEffect } from 'react';
import { useStoreBackedGlobalConfig, useStoreBackedPaths, useStoreBackedServerInfo } from '@src/hooks/useMediaMTXApi';
import useDashboardMetricsStore from '@src/store/useDashboardMetricsStore';

export function useDashboardMetrics() {
  const { data: paths } = useStoreBackedPaths();
  const { data: globalConfig } = useStoreBackedGlobalConfig();
  const { data: serverInfo } = useStoreBackedServerInfo();
  const metrics = useDashboardMetricsStore((state) => state.metrics);
  const recalculate = useDashboardMetricsStore((state) => state.recalculate);

  useEffect(() => {
    recalculate({ paths, globalConfig, serverInfo });
  }, [globalConfig, paths, recalculate, serverInfo]);

  return metrics;
}
