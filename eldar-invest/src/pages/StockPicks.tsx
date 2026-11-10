import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { tr } from '@/ai/i18n';
import { AiError, getProvider, useBackend } from '@/ai/provider';
import { useChat } from '@/ai/store';
import { buildPicks } from '@/ai/tools';
import type { Pick } from '@/ai/types';
import { AiHeader } from '@/components/ai/AiHeader';
import { PickCard } from '@/components/ai/blocks';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useAccount } from '@/stores/account';

type Horizon = 'short' | 'medium' | 'long';
type Kind = 'any' | 'stock' | 'etf';

export default function StockPicks() {
  const lang = useChat((s) => s.lang);
  const data = useAccount((s) => s.data)!;
  const backend = useBackend((s) => s.state);
  const navigate = useNavigate();
  const [horizon, setHorizon] = useState<Horizon>('medium');
  const [kind, setKind] = useState<Kind>('any');
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: Pick[]; error?: string }>({ status: 'loading', items: [] });
  const L = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);

  useEffect(() => {
    void useBackend.getState().check();
  }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const items = await buildPicks({ lang, provider: getProvider(), data: useAccount.getState().data! }, horizon, 6, kind);
      setState({ status: 'ready', items });
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('error', String(e));
      setState({ status: 'error', items: [], error: err.code.includes('rate') ? tr(lang, 'e.rate', { v: err.retryAfter ?? 60 }) : tr(lang, 'e.generic', { v: err.message }) });
    }
    // Holdings only affect the "you own it" badge, so they don't trigger a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon, kind, lang, data.profile.uid]);

  useEffect(() => {
    if (backend === 'unknown' || backend === 'checking') return;
    void load();
  }, [load, backend]);

  const ask = (prompt: string) => navigate('/ai', { state: { prompt } });

  return (
    <div className="mx-auto max-w-5xl">
      <AiHeader />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Horizon">
          {(['short', 'medium', 'long'] as const).map((h) => (
            <button key={h} role="radio" aria-checked={horizon === h} onClick={() => setHorizon(h)} className={cn('rounded-2xl border p-3 text-left transition-all', horizon === h ? 'border-brand bg-brand-soft/60 shadow-[0_0_0_3px_rgb(var(--brand)/0.12)]' : 'border-line bg-surface hover:bg-surface-2')}>
              <div className="text-[13.5px] font-semibold">{L(`c.h.${h}`)}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{L(`c.hd.${h}`)}</div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="Type">
            {(['any', 'stock', 'etf'] as const).map((k) => (
              <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn('h-9 rounded-[9px] px-3.5 text-[13px] font-semibold transition-all', kind === k ? 'bg-surface text-ink shadow-card' : 'text-ink-3')}>
                {{ any: lang === 'ru' ? 'Все' : 'All', stock: lang === 'ru' ? 'Акции' : 'Stocks', etf: 'ETF' }[k]}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" className="h-11" icon={<RefreshCw size={15} className={cn(state.status === 'loading' && 'animate-spin')} />} onClick={load} disabled={state.status === 'loading'} aria-label={L('ui.retry')} />
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] leading-snug text-ink-2">
        <ShieldAlert size={15} className="mt-0.5 shrink-0 text-ink-3" /> {L('c.picksNote')}
      </p>

      <div className="mt-4 pb-6">
        {state.status === 'loading' && (
          <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        )}
        {state.status === 'error' && (
          <div className="card flex flex-col items-center px-6 py-12 text-center" role="alert">
            <p className="max-w-sm text-[14px] text-ink-2">{state.error}</p>
            <Button className="mt-4" onClick={load}>
              {L('ui.retry')}
            </Button>
          </div>
        )}
        {state.status === 'ready' && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {state.items.map((p, i) => (
                <PickCard
                  key={p.symbol}
                  p={p}
                  lang={lang}
                  rank={i + 1}
                  footer={
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="secondary" icon={<Sparkles size={14} />} onClick={() => ask(L('sg.analyzeIt', { s: p.name }))}>
                        {lang === 'ru' ? 'Спросить ИИ' : 'Ask ELDAR AI'}
                      </Button>
                      <ButtonLink size="sm" variant="outline" to={`/markets/${p.symbol}`}>
                        {lang === 'ru' ? 'Открыть' : 'Open'}
                      </ButtonLink>
                    </div>
                  }
                />
              ))}
            </div>
            {state.items.length >= 2 && (
              <div className="mt-5 flex justify-center">
                <Button variant="secondary" icon={<Sparkles size={16} />} onClick={() => ask(L('sg.compare2', { a: state.items[0].symbol, b: state.items[1].symbol }))}>
                  {L('sg.compare2', { a: state.items[0].symbol, b: state.items[1].symbol })}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
