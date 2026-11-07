import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { Point } from '@/lib/market';

export interface LineChartProps {
  data: Point[];
  height?: number;
  /** Dashed reference line, e.g. previous close. */
  baseline?: number;
  tone: 'gain' | 'loss' | 'brand';
  formatValue: (v: number) => string;
  formatTime: (t: number) => string;
  /** Called with the hovered point (or null when the pointer leaves). */
  onHover?: (p: Point | null) => void;
  className?: string;
  ariaLabel: string;
}

const PAD_TOP = 14;
const PAD_BOTTOM = 10;
const PAD_RIGHT = 8;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Downsample to at most `max` points while keeping first/last. */
function thin(data: Point[], max: number): Point[] {
  if (data.length <= max) return data;
  const step = (data.length - 1) / (max - 1);
  const out: Point[] = [];
  for (let i = 0; i < max; i++) out.push(data[Math.round(i * step)]);
  return out;
}

export function LineChart({ data, height = 260, baseline, tone, formatValue, formatTime, onHover, className, ariaLabel }: LineChartProps) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const pts = useMemo(() => thin(data, Math.max(60, Math.min(500, width || 300))), [data, width]);

  const geo = useMemo(() => {
    if (pts.length < 2 || width === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const p of pts) {
      if (p.v < min) min = p.v;
      if (p.v > max) max = p.v;
    }
    if (baseline !== undefined) {
      min = Math.min(min, baseline);
      max = Math.max(max, baseline);
    }
    if (max - min < 1e-9) {
      max += Math.max(1, Math.abs(max) * 0.01);
      min -= Math.max(1, Math.abs(min) * 0.01);
    }
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t;
    const h = height - PAD_TOP - PAD_BOTTOM;
    // Space points evenly by index so gaps (e.g. sparse ranges) don't distort.
    const x = (i: number) => (i / (pts.length - 1)) * (width - PAD_RIGHT);
    const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * h;
    let line = '';
    pts.forEach((p, i) => (line += `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`));
    const area = `${line}L${width},${height}L0,${height}Z`;
    return { x, y, line, area, t0, t1, min, max };
  }, [pts, width, height, baseline]);

  const setIndex = useCallback(
    (i: number | null) => {
      setHover(i);
      onHover?.(i === null ? null : pts[i]);
    },
    [onHover, pts],
  );

  const fromPointer = (clientX: number) => {
    const el = wrap.current;
    if (!el || pts.length < 2) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setIndex(Math.round(Math.min(1, f * (width / Math.max(1, width - PAD_RIGHT))) * (pts.length - 1)));
  };

  const color = tone === 'gain' ? 'rgb(var(--gain))' : tone === 'loss' ? 'rgb(var(--loss))' : 'rgb(var(--brand))';
  const hp = hover !== null ? pts[hover] : null;
  const last = pts[pts.length - 1];

  return (
    <div
      ref={wrap}
      className={cn('relative w-full touch-pan-y select-none outline-none', className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerMove={(e) => fromPointer(e.clientX)}
      onPointerDown={(e) => fromPointer(e.clientX)}
      onPointerLeave={() => setIndex(null)}
      onPointerCancel={() => setIndex(null)}
      onBlur={() => setIndex(null)}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const cur = hover ?? pts.length - 1;
        setIndex(Math.min(pts.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? step : -step))));
      }}
    >
      {geo && (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={`a-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.16" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={width} y1={PAD_TOP + f * (height - PAD_TOP - PAD_BOTTOM)} y2={PAD_TOP + f * (height - PAD_TOP - PAD_BOTTOM)} stroke="rgb(var(--chart-grid))" strokeWidth="1" />
          ))}
          {baseline !== undefined && (
            <line x1="0" x2={width} y1={geo.y(baseline)} y2={geo.y(baseline)} stroke="rgb(var(--ink-3))" strokeOpacity=".6" strokeWidth="1" strokeDasharray="2 4" />
          )}
          <path d={geo.area} fill={`url(#a-${gid})`} />
          <path d={geo.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="chart-line" />
          {hp && hover !== null ? (
            <>
              <line x1={geo.x(hover)} x2={geo.x(hover)} y1={0} y2={height} stroke="rgb(var(--ink-3))" strokeOpacity=".5" strokeWidth="1" />
              <circle cx={geo.x(hover)} cy={geo.y(hp.v)} r="5" fill={color} stroke="rgb(var(--surface))" strokeWidth="2.5" />
            </>
          ) : (
            <>
              <circle cx={geo.x(pts.length - 1)} cy={geo.y(last.v)} r="7" fill={color} opacity=".18" className="animate-ping origin-center [transform-box:fill-box]" />
              <circle cx={geo.x(pts.length - 1)} cy={geo.y(last.v)} r="4" fill={color} stroke="rgb(var(--surface))" strokeWidth="2" />
            </>
          )}
        </svg>
      )}
      {geo && hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-center shadow-lift"
          style={{ left: Math.min(Math.max(geo.x(hover), 64), width - 64), transform: 'translate(-50%, -110%)' }}
        >
          <div className="num text-[13px] font-semibold text-ink">{formatValue(hp.v)}</div>
          <div className="text-[11px] text-ink-3">{formatTime(hp.t)}</div>
        </div>
      )}
      {!geo && <div className="skeleton h-full w-full rounded-xl" />}
    </div>
  );
}
