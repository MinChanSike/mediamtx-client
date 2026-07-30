import {
  runKickStreamTargetMutation,
  useStoreMutation,
} from '@src/hooks/useMediaMTXApi';
import type { KickTarget } from '@src/utils/streamDisplay';

export function useKickStreamTarget() {
  return useStoreMutation<KickTarget | KickTarget[]>(
    'kickStreamTarget',
    runKickStreamTargetMutation
  );
}
