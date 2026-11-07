import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { money, percent } from '@/lib/format';

/** Categorical slots (validated reference palette), assigned in fixed order. */
export const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];

export interface Slice {
  key: string;
  label: string;
  sub?: string;
  value: number;
  color: string;
  href?: string;
}

/**
 * Horizontal 100% bar with a legend that doubles as the data table.
 * Colors are bound to each entity (see colorFor), not to its rank.
 */
export function AllocationBar({ slices, total, hidden }: { slices: Slice[]; total: number; hidden?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const visible = slices.filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Portfolio allocation">
        {visible.map((s) => (
          <div
            key={s.key}
            className={cn('h-full transition-opacity duration-150 first:rounded-l-full last:rounded-r-full', active && active !== s.key && 'opacity-35')}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, minWidth: 3 }}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
            title={`${s.label}: ${percent(s.value / total, { sign: false })}`}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {visible.map((s) => {
          const inner = (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {s.label}
                {s.sub && <span className="ml-1.5 font-normal text-ink-3">{s.sub}</span>}
              </span>
              <span className="num text-[13px] text-ink-2">{hidden ? '••••' : money(s.value, { compact: true })}</span>
              <span className="num w-14 text-right text-[13px] font-semibold text-ink">{percent(s.value / total, { sign: false, digits: 1 })}</span>
            </>
          );
          const cls = cn('-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors', active === s.key && 'bg-surface-2');
          return (
            <li key={s.key} onPointerEnter={() => setActive(s.key)} onPointerLeave={() => setActive(null)}>
              {s.href ? (
                <Link to={s.href} className={cn(cls, 'hover:bg-surface-2')}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
