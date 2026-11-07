import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { POPULAR, searchAssets } from '@/data/assets';
import { cn } from '@/lib/cn';
import { percent, price } from '@/lib/format';
import { getQuote } from '@/lib/market';
import { useNow } from '@/stores/market';
import { useUI } from '@/stores/ui';
import { AssetIcon } from './AssetIcon';

export function SearchDialog() {
  const open = useUI((s) => s.searchOpen);
  const close = useUI((s) => s.closeSearch);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const now = useNow();
  const results = useMemo(() => (q.trim() ? searchAssets(q).slice(0, 8) : POPULAR.map((s) => searchAssets(s)[0])), [q]);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);
  useEffect(() => setIdx(0), [q]);

  if (!open) return null;
  const go = (symbol: string) => {
    close();
    navigate(`/markets/${symbol}`);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center sm:items-start sm:p-6 sm:pt-[12vh]" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div className="absolute inset-0 animate-fade-in bg-[rgb(8_12_10/0.45)] backdrop-blur-[2px]" onClick={close} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Search assets" className="relative flex h-full w-full animate-scale-in flex-col overflow-hidden bg-surface shadow-pop sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-3xl sm:border sm:border-line">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <Search size={20} className="text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIdx((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && results[idx]) go(results[idx].symbol);
            }}
            placeholder="Search by company or ticker"
            className="h-10 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
            aria-label="Search by company or ticker"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={results[idx] ? `sr-${results[idx].symbol}` : undefined}
          />
          <button onClick={close} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close search">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-2" id="search-results" role="listbox">
          <div className="eyebrow px-3 pb-1 pt-2">{q.trim() ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Popular'}</div>
          {results.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-ink-2">
              No assets match “{q}”. Try a ticker like <strong>AAPL</strong> or a name like <strong>Tesla</strong>.
            </div>
          )}
          {results.map((a, i) => {
            const quote = getQuote(a.symbol, now);
            return (
              <button
                key={a.symbol}
                id={`sr-${a.symbol}`}
                role="option"
                aria-selected={i === idx}
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(a.symbol)}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === idx && 'bg-surface-2')}
              >
                <AssetIcon symbol={a.symbol} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{a.name}</div>
                  <div className="text-[12px] text-ink-3">
                    {a.symbol} · {a.type === 'etf' ? 'ETF' : a.category}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[13.5px] font-semibold">{price(quote.price)}</div>
                  <div className={cn('num text-[12px] font-semibold', quote.changePct >= 0 ? 'text-gain' : 'text-loss')}>{percent(quote.changePct)}</div>
                </div>
                {i === idx && <CornerDownLeft size={15} className="hidden text-ink-3 sm:block" />}
              </button>
            );
          })}
        </div>
        <div className="border-t border-line px-5 py-2.5 text-[11.5px] text-ink-3">Prices shown are simulated demo data.</div>
      </div>
    </div>,
    document.body,
  );
}
