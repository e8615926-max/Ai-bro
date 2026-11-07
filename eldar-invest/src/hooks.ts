import { useMemo } from 'react';
import { summarize } from '@/domain/account';
import { getQuote } from '@/lib/market';
import { useAccount } from '@/stores/account';
import { useNow } from '@/stores/market';

export function useQuote(symbol: string) {
  const now = useNow();
  return useMemo(() => getQuote(symbol, now), [symbol, now]);
}

export function useSummary() {
  const now = useNow();
  const data = useAccount((s) => s.data);
  return useMemo(() => (data ? summarize(data, now) : null), [data, now]);
}

export function useHidden() {
  return useAccount((s) => s.data?.settings.hideBalances ?? false);
}

export function useWatch(symbol: string) {
  const watched = useAccount((s) => s.data?.watchlist.includes(symbol) ?? false);
  const toggle = useAccount((s) => s.toggleWatch);
  return [watched, () => toggle(symbol)] as const;
}
