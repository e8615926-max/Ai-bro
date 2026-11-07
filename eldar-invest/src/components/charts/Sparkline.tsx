import { memo } from 'react';

export const Sparkline = memo(function Sparkline({ values, width = 72, height = 28, baseline }: { values: number[]; width?: number; height?: number; baseline?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (baseline !== undefined) {
    min = Math.min(min, baseline);
    max = Math.max(max, baseline);
  }
  const span = max - min || 1;
  const y = (v: number) => 2 + (1 - (v - min) / span) * (height - 4);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * width).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const up = values[values.length - 1] >= (baseline ?? values[0]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      {baseline !== undefined && <line x1="0" x2={width} y1={y(baseline)} y2={y(baseline)} stroke="rgb(var(--ink-3))" strokeOpacity=".35" strokeDasharray="2 3" />}
      <path d={d} fill="none" stroke={up ? 'rgb(var(--gain))' : 'rgb(var(--loss))'} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
});
