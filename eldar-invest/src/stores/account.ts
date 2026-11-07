import { create } from 'zustand';
import {
  createUserData,
  executeTrade,
  logActivity,
  normalizeUserData,
  notify,
  resetPortfolio,
  summarize,
  TradeError,
  type OrderRequest,
} from '@/domain/account';
import type { ActivityKind, AppNotification, Transaction, UserData, UserSettings } from '@/domain/types';
import { getAsset } from '@/data/assets';
import { money, shares as fmtShares } from '@/lib/format';
import { getQuote } from '@/lib/market';
import { applyTheme } from '@/lib/theme';
import { dayNumber } from '@/lib/time';
import { userRepository } from '@/services';
import type { AuthUser } from '@/services/auth/types';
import { toast } from './toast';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type SaveStatus = 'saved' | 'saving' | 'error';

interface AccountState {
  data: UserData | null;
  status: LoadStatus;
  saveStatus: SaveStatus;
  error: string | null;

  load: (user: AuthUser) => Promise<void>;
  create: (user: AuthUser, opts: { samplePortfolio: boolean }) => Promise<void>;
  clear: () => void;
  flush: () => Promise<void>;
  destroy: (uid: string) => Promise<void>;

  trade: (order: OrderRequest) => Promise<Transaction>;
  toggleWatch: (symbol: string) => boolean;
  updateSettings: (patch: Partial<UserSettings>, message?: string) => void;
  updateNotificationPrefs: (patch: Partial<UserSettings['notifications']>) => void;
  updateProfile: (patch: { name?: string; avatarHue?: number }) => void;
  resetPortfolio: () => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearNotifications: () => void;
  log: (kind: ActivityKind, message: string) => void;
  runAutomations: (now: number) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending: Promise<void> | null = null;

// Never lose a debounced write when the tab is closed, reloaded or backgrounded.
if (typeof window !== 'undefined') {
  const flushNow = () => {
    if (saveTimer) void useAccount.getState().flush();
  };
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => document.hidden && flushNow());
}

export const useAccount = create<AccountState>((set, get) => {
  const persist = () => {
    set({ saveStatus: 'saving' });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void doSave();
    }, 250);
  };

  const doSave = async () => {
    const d = get().data;
    if (!d) return;
    pending = userRepository
      .save(d.profile.uid, d)
      .then(() => set({ saveStatus: 'saved' }))
      .catch((e: unknown) => {
        set({ saveStatus: 'error' });
        toast.error('Changes not saved', e instanceof Error ? e.message : 'Storage is unavailable.');
      });
    await pending;
  };

  const mutate = (fn: (d: UserData) => UserData) => {
    const d = get().data;
    if (!d) return;
    set({ data: fn(d) });
    persist();
  };

  return {
    data: null,
    status: 'idle',
    saveStatus: 'saved',
    error: null,

    load: async (user) => {
      set({ status: 'loading', error: null });
      try {
        const existing = await userRepository.load(user.uid);
        const data = existing ? normalizeUserData(existing) : createUserData({ uid: user.uid, name: user.name, email: user.email });
        set({ data, status: 'ready' });
        applyTheme(data.settings.theme);
        if (!existing) await doSave();
      } catch (e) {
        set({ status: 'error', error: e instanceof Error ? e.message : 'Could not load your account.' });
        throw e;
      }
    },

    create: async (user, { samplePortfolio }) => {
      const data = createUserData({ uid: user.uid, name: user.name, email: user.email }, { samplePortfolio });
      set({ data, status: 'ready' });
      applyTheme(data.settings.theme);
      await doSave();
    },

    clear: () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      set({ data: null, status: 'idle', saveStatus: 'saved' });
    },

    flush: async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        await doSave();
      } else if (pending) await pending;
    },

    destroy: async (uid) => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      await userRepository.remove(uid);
      set({ data: null, status: 'idle' });
    },

    trade: async (order) => {
      const d = get().data;
      if (!d) throw new TradeError('Your account is not loaded.');
      if (!getAsset(order.symbol)) throw new TradeError('Unknown asset.');
      // Small delay mimics order routing so the UI can show its pending state.
      await new Promise((r) => setTimeout(r, 650));
      const at = Date.now();
      const { price } = getQuote(order.symbol, at);
      const fresh = get().data ?? d;
      const result = executeTrade(fresh, order, price, at);
      const t = result.transaction;
      const verb = t.type === 'buy' ? 'Bought' : 'Sold';
      const msg = `${verb} ${fmtShares(t.shares ?? 0)} ${t.symbol} at ${money(t.price ?? 0)} (${money(t.amount)})`;
      let next = logActivity(result.data, 'trade', msg, at);
      if (fresh.settings.notifications.tradeConfirmations) {
        next = notify(next, { title: `Order filled · ${t.symbol}`, body: msg, tone: 'success', href: `/markets/${t.symbol}` }, at);
      }
      set({ data: next });
      persist();
      return t;
    },

    toggleWatch: (symbol) => {
      const d = get().data;
      if (!d) return false;
      const on = !d.watchlist.includes(symbol);
      mutate((x) =>
        logActivity(
          { ...x, watchlist: on ? [...x.watchlist, symbol] : x.watchlist.filter((s) => s !== symbol) },
          'watchlist',
          `${on ? 'Added' : 'Removed'} ${symbol} ${on ? 'to' : 'from'} watchlist`,
        ),
      );
      return on;
    },

    updateSettings: (patch, message) => {
      mutate((x) => {
        const next = { ...x, settings: { ...x.settings, ...patch } };
        return message ? logActivity(next, 'settings', message) : next;
      });
      if (patch.theme) applyTheme(patch.theme, true);
    },

    updateNotificationPrefs: (patch) =>
      mutate((x) => logActivity({ ...x, settings: { ...x.settings, notifications: { ...x.settings.notifications, ...patch } } }, 'settings', 'Notification preferences updated')),

    updateProfile: (patch) =>
      mutate((x) => logActivity({ ...x, profile: { ...x.profile, ...patch } }, 'profile', 'Profile updated')),

    resetPortfolio: () => mutate((x) => resetPortfolio(x)),

    markAllRead: () => mutate((x) => ({ ...x, notifications: x.notifications.map((n) => ({ ...n, read: true })) })),
    markRead: (id) => mutate((x) => ({ ...x, notifications: x.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
    clearNotifications: () => mutate((x) => ({ ...x, notifications: [] })),
    log: (kind, message) => mutate((x) => logActivity(x, kind, message)),

    /** Price alerts and daily summary, evaluated on every market tick. */
    runAutomations: (now) => {
      const d = get().data;
      if (!d) return;
      const prefs = d.settings.notifications;
      const today = dayNumber(now);
      const alerts: Omit<AppNotification, 'id' | 'at' | 'read'>[] = [];
      const log = { ...d.alertLog };
      if (prefs.priceAlerts) {
        const symbols = new Set([...d.watchlist, ...Object.keys(d.holdings)]);
        for (const s of symbols) {
          if (log[s] === today || !getAsset(s)) continue;
          const q = getQuote(s, now);
          if (Math.abs(q.changePct) >= prefs.priceAlertThreshold) {
            log[s] = today;
            const up = q.changePct > 0;
            alerts.push({
              title: `${s} is ${up ? 'up' : 'down'} ${(Math.abs(q.changePct) * 100).toFixed(1)}% today`,
              body: `${getAsset(s)!.name} is trading at ${money(q.price)} (simulated).`,
              tone: up ? 'success' : 'warning',
              href: `/markets/${s}`,
            });
          }
        }
      }
      if (prefs.dailySummary && log.__summary !== today) {
        log.__summary = today;
        const sum = summarize(d, now);
        alerts.push({
          title: 'Your daily summary',
          body: `Portfolio value ${money(sum.total)} · today ${money(sum.dayChange, { sign: true })} · ${sum.positions.length} position${sum.positions.length === 1 ? '' : 's'}.`,
          tone: 'info',
          href: '/portfolio',
        });
      }
      if (alerts.length === 0 && Object.keys(log).length === Object.keys(d.alertLog).length) return;
      let next: UserData = { ...d, alertLog: log };
      for (const a of alerts) next = notify(next, a, now);
      set({ data: next });
      persist();
      for (const a of alerts.filter((x) => x.tone !== 'info')) toast.info(a.title, a.body, a.href ? { label: 'View', href: a.href } : undefined);
    },
  };
});
