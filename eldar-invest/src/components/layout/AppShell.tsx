import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, FlaskConical, LogOut, Search, Settings, User, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/misc';
import { IconButton } from '@/components/ui/Button';
import { SearchDialog } from '@/components/asset/SearchDialog';
import { TradeSheet } from '@/components/trade/TradeSheet';
import { PageSkeleton } from './PageSkeleton';
import { NAV } from './nav';
import { cn } from '@/lib/cn';
import { useAccount } from '@/stores/account';
import { useMarket } from '@/stores/market';
import { useSession } from '@/stores/session';
import { useUI } from '@/stores/ui';
import { money } from '@/lib/format';
import { summarize } from '@/domain/account';
import { readRaw, writeRaw } from '@/services/storage';

function useAutomations() {
  const now = useMarket((s) => s.now);
  const run = useAccount((s) => s.runAutomations);
  const ready = useAccount((s) => s.status === 'ready');
  useEffect(() => {
    if (ready) run(now);
  }, [now, ready, run]);
}

function DemoBanner() {
  const [hidden, setHidden] = useState(() => readRaw('banner-dismissed') === '1');
  if (hidden) return null;
  return (
    <div className="border-b border-warn/20 bg-warn-soft text-warn">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-[12.5px] font-medium sm:px-6 lg:px-8">
        <FlaskConical size={14} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <strong className="font-semibold">Simulation mode.</strong> Virtual money only. All prices and charts are simulated demo data, not real market quotes.
        </span>
        <button
          className="rounded-md p-1 hover:bg-warn/10"
          aria-label="Dismiss notice"
          onClick={() => {
            writeRaw('banner-dismissed', '1');
            setHidden(true);
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function UserMenu() {
  const data = useAccount((s) => s.data);
  const signOut = useSession((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  if (!data) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-surface-2"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <Avatar name={data.profile.name} hue={data.profile.avatarHue} size={32} />
        <ChevronDown size={16} className={cn('hidden text-ink-3 transition-transform sm:block', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 animate-scale-in rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          <div className="px-3 py-2.5">
            <div className="truncate text-sm font-semibold">{data.profile.name}</div>
            <div className="truncate text-[12.5px] text-ink-3">{data.profile.email}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          {[
            { to: '/profile', label: 'Profile', icon: User },
            { to: '/settings', label: 'Settings', icon: Settings },
            { to: '/notifications', label: 'Notifications', icon: Bell },
          ].map((i) => (
            <Link key={i.to} to={i.to} role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              <i.icon size={17} /> {i.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            role="menuitem"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-loss hover:bg-loss-soft"
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const data = useAccount((s) => s.data);
  const now = useMarket((s) => s.now);
  const total = data ? summarize(data, now).total : 0;
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[248px] shrink-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <Link to="/" className="px-2">
        <Logo />
      </Link>
      <nav className="mt-9 flex flex-col gap-1" aria-label="Primary">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors',
                isActive ? 'bg-brand-soft text-brand-strong' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            <n.icon size={19} strokeWidth={2} />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        {data && (
          <div className="rounded-2xl bg-surface-2 p-4">
            <div className="eyebrow">Virtual account</div>
            <div className="num mt-1.5 text-lg font-semibold">{data.settings.hideBalances ? '••••••' : money(total)}</div>
            <div className="num mt-0.5 text-[12px] text-ink-3">Cash {data.settings.hideBalances ? '••••' : money(data.account.cash)}</div>
          </div>
        )}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors', isActive ? 'bg-brand-soft text-brand-strong' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')
          }
        >
          <Settings size={19} /> Settings
        </NavLink>
        <p className="px-3 text-[11px] leading-relaxed text-ink-3">© {new Date().getFullYear()} ELDAR COMPANY. Simulated trading for education. Not investment advice.</p>
      </div>
    </aside>
  );
}

function TopBar() {
  const openSearch = useUI((s) => s.openSearch);
  const unread = useAccount((s) => s.data?.notifications.filter((n) => !n.read).length ?? 0);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="lg:hidden" aria-label="ELDAR INVEST home">
          <Logo compact />
        </Link>
        <button
          onClick={openSearch}
          className="ml-auto flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface-2/70 px-3 text-[13.5px] text-ink-3 transition-colors hover:border-ink-3/30 hover:bg-surface-2 sm:w-72 lg:ml-0 lg:w-96"
          aria-label="Search stocks and ETFs"
        >
          <Search size={17} />
          <span className="hidden sm:inline">Search stocks & ETFs</span>
          <kbd className="ml-auto hidden rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-3 sm:inline">/</kbd>
        </button>
        <div className="flex items-center gap-1 lg:ml-auto">
          <Link to="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-ink ring-2 ring-bg">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl lg:hidden" aria-label="Primary">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => cn('flex flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-semibold transition-colors', isActive ? 'text-brand' : 'text-ink-3')}
          >
            {({ isActive }) => (
              <>
                <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-brand-soft')}>
                  <n.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function AppShell() {
  useAutomations();
  const openSearch = useUI((s) => s.openSearch);
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        openSearch();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openSearch]);

  return (
    <div className="flex min-h-[100dvh] bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <TopBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-12">
          <Suspense fallback={<PageSkeleton />}>
            <div key={loc.pathname} className="animate-rise">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
      <BottomNav />
      <SearchDialog />
      <TradeSheet />
    </div>
  );
}

export { IconButton };
