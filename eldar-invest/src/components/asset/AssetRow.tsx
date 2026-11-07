import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { getAsset } from '@/data/assets';
import { cn } from '@/lib/cn';
import { price as fmtPrice, percent } from '@/lib/format';
import { getQuote, sparkline } from '@/lib/market';
import { Sparkline } from '@/components/charts/Sparkline';
import { AssetIcon } from './AssetIcon';
import { useAccount } from '@/stores/account';
import { toast } from '@/stores/toast';

export const AssetRow = memo(function AssetRow({
  symbol,
  now,
  showSpark = true,
  showStar = false,
  right,
  className,
}: {
  symbol: string;
  now: number;
  showSpark?: boolean;
  showStar?: boolean;
  right?: React.ReactNode;
  className?: string;
}) {
  const a = getAsset(symbol);
  const watched = useAccount((s) => s.data?.watchlist.includes(symbol) ?? false);
  const toggle = useAccount((s) => s.toggleWatch);
  if (!a) return null;
  const q = getQuote(symbol, now);
  const up = q.changePct >= 0;
  return (
    <div className={cn('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2 sm:gap-4', className)}>
      <Link to={`/markets/${a.symbol}`} className="absolute inset-0 rounded-xl" aria-label={`${a.name} (${a.symbol})`} />
      <AssetIcon symbol={a.symbol} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[14.5px] font-semibold">{a.name}</span>
          {a.type === 'etf' && <span className="shrink-0 rounded bg-surface-3 px-1 text-[9.5px] font-bold text-ink-3">ETF</span>}
        </div>
        <div className="text-[12.5px] text-ink-3">{a.symbol}</div>
      </div>
      {showSpark && (
        <div className="hidden sm:block">
          <Sparkline values={sparkline(symbol, now)} baseline={q.prevClose} />
        </div>
      )}
      {right ?? (
        <div className="w-[92px] text-right">
          <div className="num text-[14.5px] font-semibold">{fmtPrice(q.price)}</div>
          <div className={cn('num text-[12.5px] font-semibold', up ? 'text-gain' : 'text-loss')}>{percent(q.changePct)}</div>
        </div>
      )}
      {showStar && (
        <button
          className={cn('relative z-10 -mr-1 rounded-lg p-1.5 transition-colors hover:bg-surface-3', watched ? 'text-warn' : 'text-ink-3')}
          aria-label={watched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
          aria-pressed={watched}
          onClick={() => {
            const on = toggle(symbol);
            toast.success(on ? `${symbol} added to watchlist` : `${symbol} removed from watchlist`);
          }}
        >
          <Star size={18} fill={watched ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  );
});
