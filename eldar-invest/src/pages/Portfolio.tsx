import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, Briefcase } from 'lucide-react';
import { AssetIcon } from '@/components/asset/AssetIcon';
import { AllocationBar, SERIES_COLORS, type Slice } from '@/components/charts/AllocationBar';
import { PageHeader } from '@/components/layout/PageHeader';
import { PerformanceCard } from '@/components/portfolio/PerformanceCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DemoBadge, EmptyState, Stat } from '@/components/ui/misc';
import { getAsset } from '@/data/assets';
import type { PositionView } from '@/domain/account';
import { cn } from '@/lib/cn';
import { money, percent, price, shares } from '@/lib/format';
import { useSummary } from '@/hooks';
import { useAccount } from '@/stores/account';
import { useUI } from '@/stores/ui';

type SortKey = 'value' | 'pnl' | 'day' | 'name';

export default function Portfolio() {
  const data = useAccount((s) => s.data)!;
  const s = useSummary()!;
  const openTrade = useUI((x) => x.openTrade);
  const hidden = data.settings.hideBalances;
  const mask = (v: string) => (hidden ? '••••' : v);
  const [sort, setSort] = useState<SortKey>('value');

  const slices = useMemo<Slice[]>(() => {
    // Colours follow the position (ordered by when it was opened), not its rank.
    const byOpen = Object.values(data.holdings).sort((a, b) => a.openedAt - b.openedAt);
    const colored = new Map(byOpen.slice(0, SERIES_COLORS.length).map((h, i) => [h.symbol, SERIES_COLORS[i]]));
    const out: Slice[] = [];
    let other = 0;
    let otherCount = 0;
    for (const p of s.positions) {
      const c = colored.get(p.symbol);
      if (c) out.push({ key: p.symbol, label: p.symbol, sub: getAsset(p.symbol)?.name, value: p.value, color: c, href: `/markets/${p.symbol}` });
      else {
        other += p.value;
        otherCount++;
      }
    }
    if (other > 0) out.push({ key: 'other', label: 'Other', sub: `${otherCount} position${otherCount === 1 ? "" : "s"}`, value: other, color: 'var(--series-other)' });
    out.push({ key: 'cash', label: 'Cash', sub: 'Virtual USD', value: s.cash, color: 'var(--series-cash)' });
    return out;
  }, [data.holdings, s.positions, s.cash]);

  const positions = useMemo(() => {
    const l = [...s.positions];
    const by: Record<SortKey, (a: PositionView, b: PositionView) => number> = {
      value: (a, b) => b.value - a.value,
      pnl: (a, b) => b.pnlPct - a.pnlPct,
      day: (a, b) => b.dayChangePct - a.dayChangePct,
      name: (a, b) => a.symbol.localeCompare(b.symbol),
    };
    return l.sort(by[sort]);
  }, [s.positions, sort]);

  return (
    <div className="space-y-6">
      <PageHeader title="Portfolio" subtitle="Your virtual investments, valued at simulated prices." action={<ButtonLink to="/markets">Invest more</ButtonLink>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformanceCard />
        </div>
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Summary</h2>
            <DemoBadge label="Simulated" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            <Stat label="Total value" value={mask(money(s.total))} />
            <Stat label="Virtual cash" value={mask(money(s.cash))} />
            <Stat label="Invested value" value={mask(money(s.invested))} />
            <Stat label="Cost basis" value={mask(money(s.costBasis))} />
            <Stat label="Unrealised P&L" value={<span className={s.unrealizedPnl >= 0 ? 'text-gain' : 'text-loss'}>{mask(money(s.unrealizedPnl, { sign: true }))}</span>} sub={<span className={s.unrealizedPnl >= 0 ? 'text-gain' : 'text-loss'}>{percent(s.unrealizedPnlPct)}</span>} />
            <Stat label="Realised P&L" value={<span className={s.realizedPnl >= 0 ? 'text-gain' : 'text-loss'}>{mask(money(s.realizedPnl, { sign: true }))}</span>} />
            <Stat label="Total return" value={<span className={s.totalReturn >= 0 ? 'text-gain' : 'text-loss'}>{mask(money(s.totalReturn, { sign: true }))}</span>} sub={<span className={s.totalReturn >= 0 ? 'text-gain' : 'text-loss'}>{percent(s.totalReturnPct)}</span>} />
            <Stat label="Starting balance" value={money(data.account.startingBalance)} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Allocation" subtitle="Share of total portfolio value" />
        <div className="p-5 sm:p-6">
          <AllocationBar slices={slices} total={s.total} hidden={hidden} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`Holdings (${s.positions.length})`}
          action={
            s.positions.length > 1 && (
              <label className="flex items-center gap-2 text-[13px] text-ink-3">
                <ArrowDownUp size={14} />
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] font-semibold text-ink outline-none focus:border-brand" aria-label="Sort holdings">
                  <option value="value">Value</option>
                  <option value="pnl">Total return</option>
                  <option value="day">Today</option>
                  <option value="name">Ticker</option>
                </select>
              </label>
            )
          }
        />
        {positions.length === 0 ? (
          <EmptyState icon={<Briefcase />} title="No investments yet" body="Your virtual cash is ready. Buy your first stock or ETF from just $1." action={<ButtonLink to="/markets">Explore markets</ButtonLink>} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto p-3 md:block">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
                    <th className="px-3 py-2 font-semibold">Asset</th>
                    <th className="px-3 py-2 text-right font-semibold">Shares</th>
                    <th className="px-3 py-2 text-right font-semibold">Avg. cost</th>
                    <th className="px-3 py-2 text-right font-semibold">Price</th>
                    <th className="px-3 py-2 text-right font-semibold">Value</th>
                    <th className="px-3 py-2 text-right font-semibold">Today</th>
                    <th className="px-3 py-2 text-right font-semibold">P&L</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol} className="group border-t border-line transition-colors hover:bg-surface-2">
                      <td className="px-3 py-3">
                        <Link to={`/markets/${p.symbol}`} className="flex items-center gap-3">
                          <AssetIcon symbol={p.symbol} size={36} />
                          <span>
                            <span className="block font-semibold">{p.symbol}</span>
                            <span className="block max-w-[180px] truncate text-[12px] text-ink-3">{getAsset(p.symbol)?.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="num px-3 py-3 text-right">{shares(p.shares)}</td>
                      <td className="num px-3 py-3 text-right">{price(p.avgCost)}</td>
                      <td className="num px-3 py-3 text-right">{price(p.price)}</td>
                      <td className="num px-3 py-3 text-right font-semibold">{mask(money(p.value))}</td>
                      <td className={cn('num px-3 py-3 text-right font-medium', p.dayChange >= 0 ? 'text-gain' : 'text-loss')}>{percent(p.dayChangePct)}</td>
                      <td className={cn('num px-3 py-3 text-right font-semibold', p.pnl >= 0 ? 'text-gain' : 'text-loss')}>
                        <div>{mask(money(p.pnl, { sign: true }))}</div>
                        <div className="text-[12px] font-medium">{percent(p.pnlPct)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => openTrade(p.symbol, 'buy')}>
                            Buy
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openTrade(p.symbol, 'sell')}>
                            Sell
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {positions.map((p) => (
                <li key={p.symbol} className="p-4">
                  <Link to={`/markets/${p.symbol}`} className="flex items-center gap-3">
                    <AssetIcon symbol={p.symbol} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{p.symbol}</div>
                      <div className="num text-[12.5px] text-ink-3">
                        {shares(p.shares)} sh · avg {price(p.avgCost)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num font-semibold">{mask(money(p.value))}</div>
                      <div className={cn('num text-[12.5px] font-semibold', p.pnl >= 0 ? 'text-gain' : 'text-loss')}>
                        {mask(money(p.pnl, { sign: true }))} ({percent(p.pnlPct)})
                      </div>
                    </div>
                  </Link>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openTrade(p.symbol, 'buy')}>
                      Buy more
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openTrade(p.symbol, 'sell')}>
                      Sell
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
