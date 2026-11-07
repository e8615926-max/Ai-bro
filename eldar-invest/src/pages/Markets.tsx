import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SearchX, X } from 'lucide-react';
import { AssetRow } from '@/components/asset/AssetRow';
import { AssetIcon } from '@/components/asset/AssetIcon';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DemoBadge, EmptyState } from '@/components/ui/misc';
import { ASSETS, CATEGORIES, POPULAR, searchAssets, type Asset } from '@/data/assets';
import { cn } from '@/lib/cn';
import { percent, price } from '@/lib/format';
import { getQuote } from '@/lib/market';
import { useNow } from '@/stores/market';
import { Link } from 'react-router-dom';

type Filter = 'all' | 'stock' | 'etf' | (typeof CATEGORIES)[number];
type Sort = 'popular' | 'gainers' | 'losers' | 'name' | 'price';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'gainers', label: 'Top gainers' },
  { value: 'losers', label: 'Top losers' },
  { value: 'price', label: 'Price' },
  { value: 'name', label: 'Name A–Z' },
];

function Movers({ title, list, now }: { title: string; list: Asset[]; now: number }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="text-[13px] font-semibold text-ink-2">{title}</div>
      <ul className="mt-3 space-y-1">
        {list.map((a) => {
          const q = getQuote(a.symbol, now);
          return (
            <li key={a.symbol}>
              <Link to={`/markets/${a.symbol}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                <AssetIcon symbol={a.symbol} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold">{a.symbol}</span>
                  <span className="block truncate text-[12px] text-ink-3">{a.name}</span>
                </span>
                <span className="text-right">
                  <span className="num block text-[13px] font-semibold">{price(q.price)}</span>
                  <span className={cn('num block text-[12px] font-semibold', q.changePct >= 0 ? 'text-gain' : 'text-loss')}>{percent(q.changePct)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function Markets() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const filter = (params.get('filter') as Filter) ?? 'all';
  const sort = (params.get('sort') as Sort) ?? 'popular';
  const [local, setLocal] = useState(query);

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (!v || (k === 'filter' && v === 'all') || (k === 'sort' && v === 'popular')) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const sortedByChange = useMemo(() => [...ASSETS].sort((a, b) => getQuote(b.symbol, now).changePct - getQuote(a.symbol, now).changePct), [now]);

  const list = useMemo(() => {
    let l = searchAssets(query);
    if (filter === 'stock' || filter === 'etf') l = l.filter((a) => a.type === filter);
    else if (filter !== 'all') l = l.filter((a) => a.category === filter);
    if (query.trim() && sort === 'popular') return l;
    const q = (a: Asset) => getQuote(a.symbol, now);
    switch (sort) {
      case 'gainers':
        return [...l].sort((a, b) => q(b).changePct - q(a).changePct);
      case 'losers':
        return [...l].sort((a, b) => q(a).changePct - q(b).changePct);
      case 'price':
        return [...l].sort((a, b) => q(b).price - q(a).price);
      case 'name':
        return [...l].sort((a, b) => a.name.localeCompare(b.name));
      default: {
        const rank = (s: string) => {
          const i = POPULAR.indexOf(s);
          return i === -1 ? 99 : i;
        };
        return [...l].sort((a, b) => rank(a.symbol) - rank(b.symbol));
      }
    }
  }, [query, filter, sort, now]);

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'stock', label: 'Stocks' },
    { value: 'etf', label: 'ETFs' },
    ...CATEGORIES.filter((c) => c !== 'ETFs').map((c) => ({ value: c as Filter, label: c })),
  ];

  return (
    <div>
      <PageHeader title="Markets" subtitle={<span className="flex flex-wrap items-center gap-2">Explore {ASSETS.length} stocks and ETFs <DemoBadge /></span>} />

      <div className="grid gap-4 md:grid-cols-2">
        <Movers title="Top gainers today" list={sortedByChange.slice(0, 3)} now={now} />
        <Movers title="Top losers today" list={sortedByChange.slice(-3).reverse()} now={now} />
      </div>

      <Card className="mt-6">
        <div className="space-y-4 border-b border-line p-4 sm:p-5">
          <div className="flex h-12 items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3.5 focus-within:border-brand focus-within:bg-surface focus-within:shadow-[0_0_0_4px_rgb(var(--brand)/0.12)]">
            <Search size={18} className="text-ink-3" />
            <input
              value={local}
              onChange={(e) => {
                setLocal(e.target.value);
                update('q', e.target.value);
              }}
              placeholder="Search by company name or ticker"
              aria-label="Search by company name or ticker"
              className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
            />
            {local && (
              <button
                onClick={() => {
                  setLocal('');
                  update('q', '');
                }}
                className="rounded-md p-1 text-ink-3 hover:text-ink"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Asset categories">
              {filters.map((f) => (
                <button
                  key={f.value}
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => update('filter', f.value)}
                  className={cn(
                    'h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                    filter === f.value ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="flex shrink-0 items-center gap-2 text-[13px] text-ink-3">
              Sort
              <select
                value={sort}
                onChange={(e) => update('sort', e.target.value)}
                className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] font-semibold text-ink outline-none focus:border-brand"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="hidden items-center gap-4 px-6 pb-1 pt-3 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3 sm:flex">
          <span className="flex-1 pl-14">Asset</span>
          <span className="w-[72px] text-center">24h</span>
          <span className="w-[92px] text-right">Price</span>
          <span className="w-8" />
        </div>
        <div className="p-2 sm:p-3">
          {list.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching assets" body={`Nothing matches “${query}”${filter !== 'all' ? ` in ${filters.find((f) => f.value === filter)?.label}` : ''}. Try another name or ticker.`} />
          ) : (
            list.map((a) => <AssetRow key={a.symbol} symbol={a.symbol} now={now} showStar />)
          )}
        </div>
      </Card>
    </div>
  );
}
