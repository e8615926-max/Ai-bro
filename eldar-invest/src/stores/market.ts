import { create } from 'zustand';

/** Global simulated-market clock. Components re-render on each tick. */
interface MarketClock {
  now: number;
  running: boolean;
  start: () => () => void;
}

const TICK_MS = 3000;

export const useMarket = create<MarketClock>((set, get) => ({
  now: Date.now(),
  running: false,
  start: () => {
    if (get().running) return () => {};
    set({ running: true, now: Date.now() });
    let timer: ReturnType<typeof setInterval> | null = null;
    const run = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => set({ now: Date.now() }), TICK_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearInterval(timer);
        timer = null;
      } else {
        set({ now: Date.now() });
        run();
      }
    };
    run();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      set({ running: false });
    };
  },
}));

export const useNow = () => useMarket((s) => s.now);
