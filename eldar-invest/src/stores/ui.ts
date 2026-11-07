import { create } from 'zustand';

interface UIState {
  searchOpen: boolean;
  trade: { symbol: string; side: 'buy' | 'sell' } | null;
  openSearch: () => void;
  closeSearch: () => void;
  openTrade: (symbol: string, side: 'buy' | 'sell') => void;
  closeTrade: () => void;
}

export const useUI = create<UIState>((set) => ({
  searchOpen: false,
  trade: null,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openTrade: (symbol, side) => set({ trade: { symbol, side } }),
  closeTrade: () => set({ trade: null }),
}));
