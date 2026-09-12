import useAppStore from '@src/store/useAppStore';
import useMediaMTXApiStore from '@src/store/useMediaMTXApiStore';
import { UNAVAILABLE_RATE, type TransferRate } from '@src/utils/transferRates';

const EMPTY_RATES: Record<string, TransferRate> = Object.freeze({});

export function useTransferRates() {
  const serverUrl = useAppStore((state) => state.serverUrl);
  return useMediaMTXApiStore((state) =>
    state.serverUrl === serverUrl ? state.transferRates : EMPTY_RATES
  );
}

export function usePathTransferRate(name?: string) {
  const rates = useTransferRates();
  return name && Object.prototype.hasOwnProperty.call(rates, name) ? rates[name] : UNAVAILABLE_RATE;
}
