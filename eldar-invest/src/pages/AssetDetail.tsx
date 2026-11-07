import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info, SearchX, Star } from 'lucide-react';
import { AssetIcon } from '@/components/asset/AssetIcon';
import { AssetRow } from '@/components/asset/AssetRow';
import { LineChart } from '@/components/charts/LineChart';
import { rangeLabel } from '@/components/portfolio/PerformanceCard';
import { TransactionList } from '@/components/portfolio/TransactionList';
import { Button, ButtonLink, IconButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { DemoBadge, EmptyState, Stat } from '@/components/ui/misc';
import { ASSETS, getAsset } from '@/data/assets';
import { cn } from '@/lib/cn';
import { compactNumber, dateTime, money, percent, price as fmtPrice, shares, shortDate, timeOnly } from '@/lib/format';
import { assetSeries, closeOn, getDayStats, getQuote, RANGES, type Point, type Range } from '@/lib/market';
import { dayNumber } from '@/lib/time';
import { useAccount } from '@/stores/account';
import { useNow } from '@/stores/market';
import { toast } from '@/stores/toast';
import { useUI } from '@/stores/ui';

export default function AssetDetail() {
  const { symbol = '' } = useParams();
  const asset = getAsset(symbol);
  if (!asset) {
    return (
      <Card>
        <EmptyState
          icon={<SearchX />}
          title="Asset not found"
          body={`We couldn't find “${symbol.toUpperCase()}” in the ELDAR INVEST catalogue.`}
          action={<ButtonLink to="/markets">Browse markets</ButtonLink>}
        />
      </Card>
    );
  }
  return <AssetView key={asset.symbol} symbol={asset.symbol} />;
}

function AssetView({ symbol }: { symbol: string }) {
  const asset = getAsset(symbol)!;
  const now = useNow();
  const navigate = useNavigate();
  const location = useLocation();
  const data = useAccount((s) => s.data)!;
  const toggleWatch = useAccount((s) => s.toggleWatch);
  const openTrade = useUI((s) => s.openTrade);
  const [range, setRange] = useState<Range>('1D');
  const [hover, setHover] = useState<Point | null>(null);

  const quote = getQuote(symbol, now);
  const series = useMemo(() => assetSeries(symbol, range, now), [symbol, range, now]);
  const stats = useMemo(() => getDayStats(symbol, now), [symbol, now]);
  const watched = data.watchlist.includes(symbol);
  const holding = data.holdings[symbol];
  const hidden = data.settings.hideBalances;
  const txs = useMemo(() => data.transactions.filter((t) => t.symbol === symbol).reverse(), [data.transactions, symbol]);

  const base = range === '1D' ? closeOn(symbol, dayNumber(now) - 1) : series[0].v;
  const shown = hover?.v ?? quote.price;
  const change = shown - base;
  const pct = change / base;
  const related = ASSETS.filter((a) => a.category === asset.category && a.symbol !== symbol).slice(0, 4);

  const position = holding
    ? (() => {
        const value = holding.shares * quote.price;
        const pnl = value - holding.costBasis;
        return { value, pnl, pnlPct: pnl / holding.costBasis, avg: holding.costBasis / holding.shares, weight: value };
      })()
    : null;

  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-5 flex items-center justify-between">
        <button onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/markets'))} className="-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
          <ArrowLeft size={18} /> Back
        </button>
        <IconButton
          label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
          aria-pressed={watched}
          className={cn('border border-line', watched && 'text-warn')}
          onClick={() => {
            const on = toggleWatch(symbol);
            toast.success(on ? `${symbol} added to watchlist` : `${symbol} removed from watchlist`);
          }}
        >
          <Star size={19} fill={watched ? 'currentColor' : 'none'} />
        </IconButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="px-5 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-start gap-3.5">
                <AssetIcon symbol={symbol} size={52} />
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[21px] font-semibold tracking-tight sm:text-[24px]">{asset.name}</h1>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
                    <span className="font-semibold text-ink-2">{symbol}</span>
                    <span>·</span>
                    <span>{asset.type === 'etf' ? 'ETF' : asset.category}</span>
                    <DemoBadge label="Simulated price" />
                  </div>
                </div>
              </div>
              <div className="num mt-5 text-[34px] font-semibold leading-none tracking-tight sm:text-[40px]">{fmtPrice(shown)}</div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[13.5px]">
                <span className={cn('num font-semibold', change >= 0 ? 'text-gain' : 'text-loss')}>
                  {money(change, { sign: true })} ({percent(pct)})
                </span>
                <span className="text-ink-3">{hover ? (range === '1D' ? timeOnly(hover.t) : range === '1W' || range === '1M' ? dateTime(hover.t) : shortDate(hover.t)) : rangeLabel(range)}</span>
              </div>
            </div>
            <div className="mt-4 px-1 sm:px-2">
              <LineChart
                data={series}
                height={280}
                baseline={range === '1D' ? base : undefined}
                tone={change >= 0 ? 'gain' : 'loss'}
                onHover={setHover}
                formatValue={fmtPrice}
                formatTime={(t) => (range === '1D' ? timeOnly(t) : range === '1W' || range === '1M' ? dateTime(t) : shortDate(t))}
                ariaLabel={`${asset.name} simulated price chart, ${rangeLabel(range)}. Use left and right arrow keys to inspect.`}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-6">
              <Segmented size="sm" label="Chart range" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r, label: r }))} />
              {range === '1D' && <span className="flex items-center gap-1.5 text-[11.5px] text-ink-3"><span className="inline-block h-px w-4 border-t border-dashed border-ink-3" /> Previous close {fmtPrice(base)}</span>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Key statistics" subtitle="Simulated values" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-4 sm:p-6">
              <Stat label="Open" value={fmtPrice(stats.open)} />
              <Stat label="Previous close" value={fmtPrice(quote.prevClose)} />
              <Stat label="Day high" value={fmtPrice(stats.high)} />
              <Stat label="Day low" value={fmtPrice(stats.low)} />
              <Stat label="52-week high" value={fmtPrice(stats.high52)} />
              <Stat label="52-week low" value={fmtPrice(stats.low52)} />
              <Stat label="Volume" value={compactNumber(stats.volume)} />
              <Stat label="Avg. volume" value={compactNumber(stats.avgVolume)} />
            </div>
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <RangeBar label="Day range" low={stats.low} high={stats.high} value={quote.price} />
              <RangeBar label="52-week range" low={stats.low52} high={stats.high52} value={quote.price} className="mt-4" />
            </div>
          </Card>

          <Card>
            <CardHeader title={`About ${asset.name}`} />
            <div className="p-5 pt-3 sm:p-6 sm:pt-3">
              <p className="text-[14.5px] leading-relaxed text-ink-2">{asset.description}</p>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-ink-3">
                <Info size={15} className="mt-0.5 shrink-0" />
                The company name and ticker identify the asset only. Prices, charts, volumes and statistics on ELDAR INVEST are generated by a simulation and do not reflect real trading.
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="text-[15px] font-semibold">Trade {symbol}</div>
            <p className="mt-1 text-[13px] text-ink-3">Commission-free simulated market orders.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button size="lg" onClick={() => openTrade(symbol, 'buy')}>
                Buy
              </Button>
              <Button size="lg" variant="sell" disabled={!holding} onClick={() => openTrade(symbol, 'sell')}>
                Sell
              </Button>
            </div>
            <div className="mt-4 flex justify-between text-[13px] text-ink-3">
              <span>Virtual cash</span>
              <span className="num font-medium text-ink">{hidden ? '••••' : money(data.account.cash)}</span>
            </div>
          </Card>

          <Card>
            <CardHeader title="Your position" />
            {position && holding ? (
              <div className="p-5 pt-4 sm:p-6 sm:pt-4">
                <div className="num text-[26px] font-semibold tracking-tight">{hidden ? '••••••' : money(position.value)}</div>
                <div className={cn('num mt-1 text-[13.5px] font-semibold', position.pnl >= 0 ? 'text-gain' : 'text-loss')}>
                  {hidden ? '••••' : money(position.pnl, { sign: true })} ({percent(position.pnlPct)}) all time
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <Stat label="Shares" value={shares(holding.shares)} />
                  <Stat label="Avg. cost" value={fmtPrice(position.avg)} />
                  <Stat label="Cost basis" value={hidden ? '••••' : money(holding.costBasis)} />
                  <Stat label="Today" value={<span className={quote.change >= 0 ? 'text-gain' : 'text-loss'}>{hidden ? '••••' : money(holding.shares * quote.change, { sign: true })}</span>} />
                </div>
              </div>
            ) : (
              <p className="px-5 pb-6 pt-3 text-[13.5px] text-ink-2 sm:px-6">You don't own {symbol} yet. Buy a fraction from $1 to start tracking it here.</p>
            )}
          </Card>

          {txs.length > 0 && (
            <Card>
              <CardHeader title="Your history" />
              <div className="p-2 sm:p-3">
                <TransactionList items={txs.slice(0, 6)} compact hidden={hidden} />
              </div>
            </Card>
          )}

          {related.length > 0 && (
            <Card>
              <CardHeader title={asset.type === 'etf' ? 'Other ETFs' : `More in ${asset.category}`} />
              <div className="p-2 sm:p-3">
                {related.map((a) => (
                  <AssetRow key={a.symbol} symbol={a.symbol} now={now} showSpark={false} />
                ))}
              </div>
            </Card>
          )}
          <p className="px-1 text-[11.5px] text-ink-3">
            Looking for something else? <Link to="/markets" className="font-semibold text-brand">Browse all markets</Link>
          </p>
        </div>
      </div>

      {/* Mobile sticky trade bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-[68px] z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <Button size="lg" variant="sell" disabled={!holding} onClick={() => openTrade(symbol, 'sell')}>
            Sell
          </Button>
          <Button size="lg" onClick={() => openTrade(symbol, 'buy')}>
            Buy {symbol}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RangeBar({ label, low, high, value, className }: { label: string; low: number; high: number; value: number; className?: string }) {
  const f = high > low ? Math.min(1, Math.max(0, (value - low) / (high - low))) : 0.5;
  return (
    <div className={className}>
      <div className="flex justify-between text-[12px] text-ink-3">
        <span>{label}</span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-surface-3">
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand/40" style={{ width: `${f * 100}%` }} />
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand shadow" style={{ left: `${f * 100}%` }} />
      </div>
      <div className="num mt-1.5 flex justify-between text-[12px] font-medium text-ink-2">
        <span>{fmtPrice(low)}</span>
        <span>{fmtPrice(high)}</span>
      </div>
    </div>
  );
}
