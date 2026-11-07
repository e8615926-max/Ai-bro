import { Link } from 'react-router-dom';
import { Plus, Star, Trash2 } from 'lucide-react';
import { AssetIcon } from '@/components/asset/AssetIcon';
import { Sparkline } from '@/components/charts/Sparkline';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DemoBadge, EmptyState } from '@/components/ui/misc';
import { getAsset, POPULAR } from '@/data/assets';
import { cn } from '@/lib/cn';
import { money, percent, price } from '@/lib/format';
import { getQuote, rangeChange, sparkline } from '@/lib/market';
import { useAccount } from '@/stores/account';
import { useNow } from '@/stores/market';
import { toast } from '@/stores/toast';
import { useUI } from '@/stores/ui';

export default function Watchlist() {
  const list = useAccount((s) => s.data!.watchlist);
  const toggle = useAccount((s) => s.toggleWatch);
  const openSearch = useUI((s) => s.openSearch);
  const openTrade = useUI((s) => s.openTrade);
  const now = useNow();
  const suggestions = POPULAR.filter((s) => !list.includes(s)).slice(0, 4);

  const remove = (s: string) => {
    toggle(s);
    toast.success(`${s} removed from watchlist`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlist"
        subtitle={<span className="flex flex-wrap items-center gap-2">Track the assets you care about <DemoBadge /></span>}
        action={
          <Button variant="secondary" icon={<Plus size={18} />} onClick={openSearch}>
            Add asset
          </Button>
        }
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Star />} title="Your watchlist is empty" body="Add stocks and ETFs to follow their simulated price moves at a glance." action={<ButtonLink to="/markets">Browse markets</ButtonLink>} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((sym) => {
            const a = getAsset(sym);
            if (!a) return null;
            const q = getQuote(sym, now);
            const week = rangeChange(sym, '1W', now);
            const up = q.changePct >= 0;
            return (
              <Card key={sym} className="group relative p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift">
                <Link to={`/markets/${sym}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${a.name}`} />
                <div className="flex items-start gap-3">
                  <AssetIcon symbol={sym} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{a.name}</div>
                    <div className="text-[12.5px] text-ink-3">{sym}</div>
                  </div>
                  <IconButton label={`Remove ${sym} from watchlist`} size="sm" className="relative z-10 text-warn" onClick={() => remove(sym)}>
                    <Star size={18} fill="currentColor" />
                  </IconButton>
                </div>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <div className="num text-[22px] font-semibold tracking-tight">{price(q.price)}</div>
                    <div className={cn('num text-[13px] font-semibold', up ? 'text-gain' : 'text-loss')}>
                      {money(q.change, { sign: true })} ({percent(q.changePct)})
                    </div>
                  </div>
                  <Sparkline values={sparkline(sym, now)} baseline={q.prevClose} width={110} height={40} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12.5px]">
                  <span className="text-ink-3">
                    1W <span className={cn('num font-semibold', week.changePct >= 0 ? 'text-gain' : 'text-loss')}>{percent(week.changePct)}</span>
                  </span>
                  <div className="relative z-10 flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openTrade(sym, 'buy')}>
                      Buy
                    </Button>
                    <IconButton label={`Delete ${sym}`} size="sm" onClick={() => remove(sym)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold">Suggested to follow</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions.map((s) => {
              const q = getQuote(s, now);
              return (
                <Card key={s} className="flex items-center gap-3 p-3.5">
                  <AssetIcon symbol={s} size={36} />
                  <Link to={`/markets/${s}`} className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{s}</div>
                    <div className={cn('num text-[12px] font-semibold', q.changePct >= 0 ? 'text-gain' : 'text-loss')}>{percent(q.changePct)}</div>
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus size={15} />}
                    onClick={() => {
                      toggle(s);
                      toast.success(`${s} added to watchlist`);
                    }}
                    aria-label={`Add ${s} to watchlist`}
                  >
                    Follow
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
