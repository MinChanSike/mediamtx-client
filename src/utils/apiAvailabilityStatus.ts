export type ApiAvailabilityStatus = 'online' | 'offline' | 'connecting';

export function getApiAvailabilityStatus(state: {
  data?: unknown;
  isError: boolean;
  isPending: boolean;
}): ApiAvailabilityStatus {
  if (state.isError) return 'offline';
  if (state.isPending) return 'connecting';
  return 'online';
}
