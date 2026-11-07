import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, Download, History, KeyRound, LogIn, LogOut, RotateCcw, Search, Settings2, Star, UserRound, ArrowLeftRight, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { TransactionList } from '@/components/portfolio/TransactionList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/misc';
import type { ActivityEntry, Transaction } from '@/domain/types';
import { dayGroupLabel, money, timeOnly } from '@/lib/format';
import { downloadFile, toCSV } from '@/lib/download';
import { useAccount } from '@/stores/account';
import { toast } from '@/stores/toast';
import { getAsset } from '@/data/assets';

type Tab = 'transactions' | 'activity';
type TxFilter = 'all' | 'buy' | 'sell';

function groupByDay<T extends { at: number }>(items: T[]) {
  const groups: { label: string; items: T[] }[] = [];
  for (const it of items) {
    const label = dayGroupLabel(it.at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(it);
    else groups.push({ label, items: [it] });
  }
  return groups;
}

const ICONS: Record<ActivityEntry['kind'], typeof History> = {
  register: Sparkles,
  login: LogIn,
  logout: LogOut,
  trade: ArrowLeftRight,
  watchlist: Star,
  settings: Settings2,
  profile: UserRound,
  security: KeyRound,
  reset: RotateCcw,
};

export default function Activity() {
  const data = useAccount((s) => s.data)!;
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'transactions';
  const [filter, setFilter] = useState<TxFilter>('all');
  const [q, setQ] = useState('');
  const hidden = data.settings.hideBalances;

  const txs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...data.transactions]
      .reverse()
      .filter((t) => filter === 'all' || t.type === filter)
      .filter((t) => !needle || t.symbol?.toLowerCase().includes(needle) || getAsset(t.symbol)?.name.toLowerCase().includes(needle));
  }, [data.transactions, filter, q]);

  const totals = useMemo(() => {
    let bought = 0;
    let sold = 0;
    let realized = 0;
    for (const t of data.transactions) {
      if (t.type === 'buy') bought += t.amount;
      if (t.type === 'sell') {
        sold += t.amount;
        realized += t.realizedPnl ?? 0;
      }
    }
    return { bought, sold, realized, count: data.transactions.filter((t) => t.type !== 'deposit').length };
  }, [data.transactions]);

  const exportCSV = () => {
    const rows: (string | number)[][] = [['Date', 'Type', 'Symbol', 'Shares', 'Price (USD)', 'Amount (USD)', 'Realised P&L (USD)', 'Cash after (USD)', 'Sample']];
    for (const t of [...data.transactions].reverse()) {
      rows.push([new Date(t.at).toISOString(), t.type, t.symbol ?? '', t.shares ?? '', t.price?.toFixed(4) ?? '', t.amount.toFixed(2), t.realizedPnl?.toFixed(2) ?? '', t.cashAfter.toFixed(2), t.sample ? 'yes' : '']);
    }
    downloadFile(`eldar-invest-transactions-${new Date().toISOString().slice(0, 10)}.csv`, '# ELDAR INVEST simulated transactions (virtual money, demo prices)\n' + toCSV(rows), 'text/csv');
    toast.success('Export ready', 'Your transaction history was downloaded as CSV.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        subtitle="Every simulated trade and account event."
        action={
          tab === 'transactions' && (
            <Button variant="secondary" icon={<Download size={17} />} onClick={exportCSV}>
              Export CSV
            </Button>
          )
        }
      />

      <Segmented
        label="Activity type"
        value={tab}
        onChange={(v) => setParams(v === 'transactions' ? {} : { tab: v }, { replace: true })}
        options={[
          { value: 'transactions', label: 'Transactions' },
          { value: 'activity', label: 'Account activity' },
        ]}
      />

      {tab === 'transactions' ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Trades', String(totals.count)],
              ['Total bought', hidden ? '••••' : money(totals.bought)],
              ['Total sold', hidden ? '••••' : money(totals.sold)],
              ['Realised P&L', hidden ? '••••' : money(totals.realized, { sign: true })],
            ].map(([k, v]) => (
              <Card key={k} className="p-4">
                <div className="text-[12px] font-medium text-ink-3">{k}</div>
                <div className="num mt-1 text-[17px] font-semibold">{v}</div>
              </Card>
            ))}
          </div>
          <Card>
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
              <Segmented
                size="sm"
                label="Transaction filter"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'buy', label: 'Buys' },
                  { value: 'sell', label: 'Sells' },
                ]}
              />
              <div className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 focus-within:border-brand sm:w-64">
                <Search size={15} className="text-ink-3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by asset" aria-label="Filter transactions by asset" className="h-full flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-3" />
              </div>
            </div>
            {txs.length === 0 ? (
              <EmptyState icon={<History />} title="No transactions found" body={q || filter !== 'all' ? 'Try clearing the filters.' : 'Your trades will appear here.'} />
            ) : (
              <div className="p-2 sm:p-3">
                {groupByDay<Transaction>(txs).map((g) => (
                  <div key={g.label} className="mb-2">
                    <div className="eyebrow px-3 pb-1 pt-3">{g.label}</div>
                    <TransactionList items={g.items} hidden={hidden} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          {data.activity.length === 0 ? (
            <EmptyState icon={<Bell />} title="No activity yet" body="Sign-ins, settings changes and trades will be listed here." />
          ) : (
            <div className="p-2 sm:p-3">
              {groupByDay(data.activity).map((g) => (
                <div key={g.label} className="mb-2">
                  <div className="eyebrow px-3 pb-1 pt-3">{g.label}</div>
                  <ul>
                    {g.items.map((a) => {
                      const Icon = ICONS[a.kind] ?? History;
                      return (
                        <li key={a.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                            <Icon size={16} />
                          </span>
                          <span className="min-w-0 flex-1 text-[14px]">{a.message}</span>
                          <span className="shrink-0 text-[12px] text-ink-3">{timeOnly(a.at)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
