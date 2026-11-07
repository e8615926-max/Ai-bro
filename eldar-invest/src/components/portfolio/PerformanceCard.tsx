import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { LineChart } from '@/components/charts/LineChart';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { DemoBadge } from '@/components/ui/misc';
import { portfolioHistory } from '@/domain/account';
import { cn } from '@/lib/cn';
import { dateTime, money, percent, shortDate, timeOnly } from '@/lib/format';
import { pricerFor, RANGES, timeGrid, type Point, type Range } from '@/lib/market';
import { useSummary } from '@/hooks';
import { useAccount } from '@/stores/account';
import { useNow } from '@/stores/market';

export function PerformanceCard() {
  const data = useAccount((s) => s.data)!;
  const updateSettings = useAccount((s) => s.updateSettings);
  const now = useNow();
  const summary = useSummary()!;
  const [range, setRange] = useState<Range>(data.settings.defaultRange);
  const [hover, setHover] = useState<Point | null>(null);
  const hidden = data.settings.hideBalances;

  const series = useMemo(() => {
    const grid = timeGrid(range, now, data.account.startedAt);
    return portfolioHistory(data, grid, pricerFor(range, now));
  }, [data, range, now]);

  const first = series[0]?.v ?? summary.total;
  const shown = hover?.v ?? summary.total;
  const change = shown - first;
  const pct = first > 0 ? change / first : 0;
  const tone = change >= 0 ? 'gain' : 'loss';
  const sinceStart = series[0] && series[0].t <= data.account.startedAt + 60_000 && range !== '1D';

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-ink-2">Total portfolio value</span>
            <button
              onClick={() => updateSettings({ hideBalances: !hidden })}
              className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
              aria-label={hidden ? 'Show balances' : 'Hide balances'}
            >
              {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <DemoBadge label="Simulated" />
        </div>
        <div className="num mt-2 text-[34px] font-semibold leading-none tracking-tight sm:text-[40px]">{hidden ? '$••••••' : money(shown)}</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
          <span className={cn('num font-semibold', tone === 'gain' ? 'text-gain' : 'text-loss')}>
            {hidden ? '••••' : money(change, { sign: true })} ({percent(pct)})
          </span>
          <span className="text-ink-3">
            {hover ? (range === '1D' || range === '1W' ? dateTime(hover.t) : shortDate(hover.t)) : sinceStart ? 'since portfolio start' : rangeLabel(range)}
          </span>
        </div>
      </div>
      <div className="mt-4 px-1 sm:px-2">
        <LineChart
          data={series}
          height={230}
          tone={tone}
          onHover={setHover}
          formatValue={(v) => (hidden ? '••••' : money(v))}
          formatTime={(t) => (range === '1D' ? timeOnly(t) : range === '1W' || range === '1M' ? dateTime(t) : shortDate(t))}
          ariaLabel={`Portfolio value chart, ${rangeLabel(range)}. Current value ${money(summary.total)}.`}
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-6">
        <Segmented size="sm" label="Chart range" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r, label: r }))} />
        <span className="hidden text-[11.5px] text-ink-3 sm:block">Based on simulated prices</span>
      </div>
    </Card>
  );
}

export function rangeLabel(r: Range) {
  return { '1D': 'today', '1W': 'past week', '1M': 'past month', '3M': 'past 3 months', '1Y': 'past year', '5Y': 'past 5 years' }[r];
}
