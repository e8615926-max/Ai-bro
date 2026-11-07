import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, Plus, Star, Wallet } from 'lucide-react';
import { PerformanceCard } from '@/components/portfolio/PerformanceCard';
import { AssetRow } from '@/components/asset/AssetRow';
import { AssetIcon } from '@/components/asset/AssetIcon';
import { TransactionList } from '@/components/portfolio/TransactionList';
import { Card, CardHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/misc';
import { getAsset, POPULAR } from '@/data/assets';
import { cn } from '@/lib/cn';
import { money, percent, price } from '@/lib/format';
import { getQuote } from '@/lib/market';
import { useSummary } from '@/hooks';
import { useAccount } from '@/stores/account';
import { useNow } from '@/stores/market';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function KPI({ label, value, sub, tone, icon: Icon }: { label: string; value: string; sub?: string; tone?: 'gain' | 'loss'; icon: typeof Wallet }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-3">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tone === 'gain' ? 'bg-gain-soft text-gain' : tone === 'loss' ? 'bg-loss-soft text-loss' : 'bg-surface-2 text-ink-2')}>
          <Icon size={15} />
        </span>
        {label}
      </div>
      <div className={cn('num mt-3 text-[19px] font-semibold tracking-tight sm:text-[21px]', tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink')}>{value}</div>
      {sub && <div className={cn('num mt-0.5 text-[12.5px] font-medium', tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink-3')}>{sub}</div>}
    </Card>
  );
}

function MoversStrip() {
  const now = useNow();
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
      {POPULAR.slice(0, 4).map((s) => {
        const q = getQuote(s, now);
        const up = q.changePct >= 0;
        return (
          <Link key={s} to={`/markets/${s}`} className="card group min-w-[168px] snap-start p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift">
            <div className="flex items-center justify-between">
              <AssetIcon symbol={s} size={34} />
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', up ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss')}>
                {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              </span>
            </div>
            <div className="mt-3 text-[13px] font-semibold">{s}</div>
            <div className="truncate text-[12px] text-ink-3">{getAsset(s)?.name}</div>
            <div className="num mt-2 text-[15px] font-semibold">{price(q.price)}</div>
            <div className={cn('num text-[12.5px] font-semibold', up ? 'text-gain' : 'text-loss')}>{percent(q.changePct)}</div>
          </Link>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const data = useAccount((s) => s.data)!;
  const s = useSummary()!;
  const now = useNow();
  const hidden = data.settings.hideBalances;
  const mask = (v: string) => (hidden ? '••••••' : v);
  const firstName = data.profile.name.split(' ')[0];
  const recent = [...data.transactions].reverse().slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] text-ink-3">{greeting()},</p>
          <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">{firstName}</h1>
        </div>
        <div className="flex gap-2">
          <ButtonLink to="/markets" icon={<Plus size={18} />}>
            Invest
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <PerformanceCard />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KPI icon={s.dayChange >= 0 ? ArrowUpRight : ArrowDownRight} label="Today" value={mask(money(s.dayChange, { sign: true }))} sub={percent(s.dayChangePct)} tone={s.dayChange >= 0 ? 'gain' : 'loss'} />
            <KPI icon={s.totalReturn >= 0 ? ArrowUpRight : ArrowDownRight} label="Total return" value={mask(money(s.totalReturn, { sign: true }))} sub={percent(s.totalReturnPct)} tone={s.totalReturn >= 0 ? 'gain' : 'loss'} />
            <KPI icon={Wallet} label="Invested" value={mask(money(s.invested))} sub={`${s.positions.length} position${s.positions.length === 1 ? '' : 's'}`} />
            <KPI icon={Banknote} label="Virtual cash" value={mask(money(s.cash))} sub="Available to invest" />
          </div>
        </div>

        <Card className="flex min-w-0 flex-col">
          <CardHeader
            title="Favourites"
            subtitle="Your watchlist"
            action={
              <Link to="/watchlist" className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-strong">
                See all <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="flex-1 px-2 py-2 sm:px-3">
            {data.watchlist.length === 0 ? (
              <EmptyState icon={<Star />} title="No favourites yet" body="Tap the star on any asset to follow it here." action={<ButtonLink to="/markets" variant="secondary" size="sm">Browse markets</ButtonLink>} />
            ) : (
              data.watchlist.slice(0, 6).map((sym) => <AssetRow key={sym} symbol={sym} now={now} showSpark={false} />)
            )}
          </div>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold tracking-tight">Popular today</h2>
          <Link to="/markets" className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-strong">
            Explore markets <ArrowRight size={14} />
          </Link>
        </div>
        <MoversStrip />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Your holdings"
            action={
              <Link to="/portfolio" className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-strong">
                Portfolio <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="px-2 py-2 sm:px-3">
            {s.positions.length === 0 ? (
              <EmptyState icon={<Wallet />} title="Make your first investment" body="You have virtual cash ready. Pick a stock or ETF to get started." action={<ButtonLink to="/markets" size="sm">Find an asset</ButtonLink>} />
            ) : (
              s.positions.slice(0, 5).map((p) => (
                <AssetRow
                  key={p.symbol}
                  symbol={p.symbol}
                  now={now}
                  right={
                    <div className="w-[110px] text-right">
                      <div className="num text-[14.5px] font-semibold">{mask(money(p.value))}</div>
                      <div className={cn('num text-[12.5px] font-semibold', p.pnl >= 0 ? 'text-gain' : 'text-loss')}>{percent(p.pnlPct)}</div>
                    </div>
                  }
                />
              ))
            )}
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader
            title="Recent transactions"
            action={
              <Link to="/activity" className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-strong">
                All <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="px-2 py-2 sm:px-3">
            <TransactionList items={recent} compact hidden={hidden} />
          </div>
        </Card>
      </div>
    </div>
  );
}
