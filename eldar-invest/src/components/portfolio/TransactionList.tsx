import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Landmark } from 'lucide-react';
import { getAsset } from '@/data/assets';
import type { Transaction } from '@/domain/types';
import { cn } from '@/lib/cn';
import { dateTime, money, price, relativeTime, shares } from '@/lib/format';
import { Badge } from '@/components/ui/misc';

export function TransactionList({ items, compact, hidden }: { items: Transaction[]; compact?: boolean; hidden?: boolean }) {
  if (items.length === 0) return <p className="px-3 py-8 text-center text-sm text-ink-3">No transactions yet.</p>;
  return (
    <ul>
      {items.map((t) => {
        const isTrade = t.type !== 'deposit';
        const Icon = t.type === 'buy' ? ArrowDownLeft : t.type === 'sell' ? ArrowUpRight : Landmark;
        const title = t.type === 'deposit' ? 'Virtual funds added' : `${t.type === 'buy' ? 'Bought' : 'Sold'} ${t.symbol}`;
        const body = (
          <>
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', t.type === 'buy' ? 'bg-brand-soft text-brand' : t.type === 'sell' ? 'bg-surface-3 text-ink' : 'bg-warn-soft text-warn')}>
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-[14px] font-semibold">{title}</span>
                {t.sample && <Badge className="shrink-0">Sample</Badge>}
              </div>
              <div className="truncate text-[12.5px] text-ink-3">
                {isTrade ? `${shares(t.shares ?? 0)} sh @ ${price(t.price ?? 0)}` : 'Starting balance'}
                {!compact && isTrade && ` · ${getAsset(t.symbol)?.name ?? ''}`}
              </div>
            </div>
            <div className="text-right">
              <div className={cn('num text-[14px] font-semibold', t.type === 'buy' ? 'text-ink' : 'text-gain')}>
                {hidden ? '••••' : `${t.type === 'buy' ? '−' : '+'}${money(t.amount)}`}
              </div>
              <div className="text-[12px] text-ink-3" title={dateTime(t.at)}>
                {compact ? relativeTime(t.at) : dateTime(t.at)}
              </div>
            </div>
          </>
        );
        const cls = 'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors';
        return (
          <li key={t.id}>
            {t.symbol ? (
              <Link to={`/markets/${t.symbol}`} className={cn(cls, 'hover:bg-surface-2')}>
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
