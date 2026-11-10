import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { Series } from '@/ai/types';

const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-6)'];
const PAD = { top: 12, bottom: 8, right: 10 };

/**
 * Interactive chart for one or several series. With several series the
 * values are shown as % change from each series' first point, so assets
 * with different prices share one honest axis.
 */
export function SeriesChart({
  series,
  normalized,
  height = 220,
  formatValue,
  formatTime,
  ariaLabel,
}: {
  series: Series[];
  normalized: boolean;
  height?: number;
  formatValue: (v: number) => string;
  formatTime: (t: number) => string;
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [frac, setFrac] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const lines = useMemo(
    () =>
      series
        .filter((s) => s.points.length >= 2)
        .map((s) => ({ ...s, values: s.points.map((p) => (normalized ? (p.v / s.points[0].v - 1) * 100 : p.v)) })),
    [series, normalized],
  );

  const geo = useMemo(() => {
    if (!lines.length || !width) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const l of lines) for (const v of l.values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (normalized) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
    if (max - min < 1e-9) {
      max += 1;
      min -= 1;
    }
    const h = height - PAD.top - PAD.bottom;
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * h;
    const x = (i: number, n: number) => (i / (n - 1)) * (width - PAD.right);
    const paths = lines.map((l) => l.values.map((v, i) => `${i ? 'L' : 'M'}${x(i, l.values.length).toFixed(1)},${y(v).toFixed(1)}`).join(''));
    return { x, y, paths };
  }, [lines, width, height, normalized]);

  const single = lines.length === 1;
  const up = single && lines[0].values[lines[0].values.length - 1] >= lines[0].values[0];
  const colorOf = (i: number) => (single ? (up ? 'rgb(var(--gain))' : 'rgb(var(--loss))') : COLORS[i % COLORS.length]);
  const idx = (n: number) => (frac === null ? n - 1 : Math.round(frac * (n - 1)));
  const fmt = (v: number) => (normalized ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%` : formatValue(v));

  const move = (clientX: number) => {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFrac(Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width - PAD.right))));
  };

  return (
    <div>
      {!single && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {lines.map((l, i) => (
            <span key={l.key} className="flex items-center gap-1.5 text-[12.5px]">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colorOf(i) }} />
              <span className="font-semibold text-ink">{l.label}</span>
              <span className="num text-ink-2">{fmt(l.values[idx(l.values.length)])}</span>
            </span>
          ))}
        </div>
      )}
      <div
        ref={wrap}
        className="relative w-full touch-pan-y select-none outline-none"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={(e) => move(e.clientX)}
        onPointerDown={(e) => move(e.clientX)}
        onPointerLeave={() => setFrac(null)}
        onPointerCancel={() => setFrac(null)}
        onBlur={() => setFrac(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          setFrac((f) => Math.min(1, Math.max(0, (f ?? 1) + (e.key === 'ArrowRight' ? 0.02 : -0.02))));
        }}
      >
        {geo ? (
          <svg width={width} height={height} className="block overflow-visible">
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={width} y1={PAD.top + f * (height - PAD.top - PAD.bottom)} y2={PAD.top + f * (height - PAD.top - PAD.bottom)} stroke="rgb(var(--chart-grid))" />
            ))}
            {normalized && <line x1="0" x2={width} y1={geo.y(0)} y2={geo.y(0)} stroke="rgb(var(--ink-3))" strokeOpacity=".6" strokeDasharray="2 4" />}
            {single && (
              <>
                <defs>
                  <linearGradient id={`sc-${lines[0].key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={colorOf(0)} stopOpacity=".14" />
                    <stop offset="1" stopColor={colorOf(0)} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${geo.paths[0]}L${width - PAD.right},${height}L0,${height}Z`} fill={`url(#sc-${lines[0].key})`} />
              </>
            )}
            {geo.paths.map((d, i) => (
              <path key={lines[i].key} d={d} fill="none" stroke={colorOf(i)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {frac !== null && <line x1={frac * (width - PAD.right)} x2={frac * (width - PAD.right)} y1="0" y2={height} stroke="rgb(var(--ink-3))" strokeOpacity=".5" />}
            {lines.map((l, i) => {
              const k = idx(l.values.length);
              return <circle key={l.key} cx={geo.x(k, l.values.length)} cy={geo.y(l.values[k])} r="4" fill={colorOf(i)} stroke="rgb(var(--surface))" strokeWidth="2" />;
            })}
          </svg>
        ) : (
          <div className="skeleton h-full w-full rounded-xl" />
        )}
        {geo && frac !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 shadow-lift"
            style={{ left: Math.min(Math.max(frac * (width - PAD.right), 70), width - 70), transform: 'translate(-50%, -105%)' }}
          >
            {lines.map((l, i) => (
              <div key={l.key} className="flex items-center justify-between gap-3 text-[12.5px]">
                {!single && (
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: colorOf(i) }} />
                    {l.label}
                  </span>
                )}
                <span className="num font-semibold text-ink">{fmt(l.values[idx(l.values.length)])}</span>
              </div>
            ))}
            <div className={cn('text-[11px] text-ink-3', !single && 'mt-0.5')}>{formatTime(lines[0].points[idx(lines[0].points.length)].t)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
