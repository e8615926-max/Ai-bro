import { Suspense, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { FlaskConical, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/Spinner';
import { persistentStorageAvailable } from '@/services/storage';
import { priceAt } from '@/lib/market';
import { HOUR } from '@/lib/time';
import { useNow } from '@/stores/market';

function ShowcaseCard() {
  const now = useNow();
  const pts = useMemo(() => {
    const out: number[] = [];
    const t0 = Math.floor(now / HOUR) * HOUR;
    for (let i = 72; i >= 0; i--) out.push(priceAt('SPY', t0 - i * 2 * HOUR));
    return out;
  }, [now]);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 300},${8 + (1 - (v - min) / (max - min || 1)) * 84}`).join('');
  const change = (pts[pts.length - 1] - pts[0]) / pts[0];
  return (
    <div className="relative w-full max-w-sm rounded-3xl border border-white/15 bg-white/10 p-5 text-white shadow-[0_30px_80px_-20px_rgb(0_0_0/0.4)] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] font-medium text-white/70">SPY · 6-day view</div>
          <div className="num mt-1 text-2xl font-semibold">${pts[pts.length - 1].toFixed(2)}</div>
        </div>
        <span className="num rounded-lg bg-white/15 px-2 py-1 text-[12px] font-semibold">
          {change >= 0 ? '+' : '−'}
          {Math.abs(change * 100).toFixed(2)}%
        </span>
      </div>
      <svg viewBox="0 0 300 100" className="mt-4 h-24 w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="sc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d}L300,100L0,100Z`} fill="url(#sc)" />
        <path d={d} fill="none" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-white/70">
        <FlaskConical size={12} /> Simulated demo data, not real market quotes
      </div>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="flex min-h-[100dvh] bg-bg">
      <div className="relative hidden w-[46%] max-w-[680px] flex-col justify-between overflow-hidden bg-[linear-gradient(150deg,#0f9f62_0%,#0a7a4b_55%,#06492e_100%)] p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full bg-[#19c37d]/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <LogoMark size={40} />
          <div className="leading-none">
            <div className="text-[17px] font-bold tracking-[0.16em]">ELDAR</div>
            <div className="mt-1 text-[10px] font-semibold tracking-[0.34em] text-white/70">INVEST</div>
          </div>
        </div>
        <div className="relative">
          <h2 className="max-w-md text-[40px] font-semibold leading-[1.1] tracking-tight">Learn to invest with confidence, without risking a cent.</h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
            Build a virtual portfolio of stocks and ETFs, follow simulated markets in real time and track every decision.
          </p>
          <div className="mt-10">
            <ShowcaseCard />
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-4 text-[12.5px] text-white/80">
          <div className="flex items-center gap-2">
            <Sparkles size={16} /> $100k virtual funds
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} /> No real money
          </div>
          <div className="flex items-center gap-2">
            <Lock size={16} /> Hashed passwords
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-5 sm:p-8 lg:justify-end">
          <span className="lg:hidden">
            <Logo />
          </span>
          <span className="text-[12px] font-medium text-ink-3">by ELDAR COMPANY</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-[400px] animate-rise">
            {!persistentStorageAvailable() && (
              <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[12.5px] leading-relaxed text-warn" role="status">
                <strong className="font-semibold">Preview mode:</strong> this viewer blocks browser storage, so your account and trades will reset when it closes. Download the file and open it in Chrome, Safari or another browser to keep your data.
              </div>
            )}
            <Suspense
              fallback={
                <div className="flex justify-center py-20 text-ink-3">
                  <Spinner className="h-6 w-6" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </div>
        <p className="px-6 pb-6 text-center text-[11.5px] text-ink-3">
          ELDAR INVEST is a simulated trading platform for education. No real money, securities or market data are used.
        </p>
      </div>
    </div>
  );
}
