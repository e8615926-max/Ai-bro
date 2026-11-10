import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, CircleAlert, ExternalLink, FlaskConical, Info, Minus, ShieldAlert, Signal as SignalIcon, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import { AI_RANGES, type AiLang, type AiRange } from '@shared/aiTools';
import { category, describe, tr } from '@/ai/i18n';
import { getProvider } from '@/ai/provider';
import { useChat } from '@/ai/store';
import { loadChart } from '@/ai/tools';
import type { Block, CompanyReport, Forecast, Meta, MetricsTable, NewsItem, Pick, PortfolioAnalysis, QuoteInfo, Signal, TradeProposal } from '@/ai/types';
import { AssetIcon } from '@/components/asset/AssetIcon';
import { Button } from '@/components/ui/Button';
import { getAsset } from '@/data/assets';
import { TradeError } from '@/domain/account';
import { cn } from '@/lib/cn';
import { money, percent, shares as fmtShares } from '@/lib/format';
import { priceAt } from '@/lib/market';
import { useAccount } from '@/stores/account';
import { useNow } from '@/stores/market';
import { toast } from '@/stores/toast';
import { SeriesChart } from './SeriesChart';

const locale = (lang: AiLang) => (lang === 'ru' ? 'ru-RU' : 'en-US');
export const fmtDateTime = (lang: AiLang, t: number) => new Date(t).toLocaleString(locale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDate = (lang: AiLang, t: number | string) => new Date(t).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' });

/* ------------------------------ Shared pieces ----------------------------- */

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-card', className)}>{children}</div>;
}

/** Every data card ends with this line: where the numbers came from and when. */
export function SourceLine({ meta, lang, className }: { meta: Meta; lang: AiLang; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-3', className)}>
      <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide', meta.real ? 'bg-gain-soft text-gain' : 'border border-warn/30 bg-warn-soft text-warn')}>
        {meta.real ? <SignalIcon size={10} strokeWidth={3} /> : <FlaskConical size={10} strokeWidth={2.5} />}
        {tr(lang, meta.real ? 'ui.realBadge' : 'ui.demoBadge')}
      </span>
      <span>
        {tr(lang, 'ui.source')}: {meta.source} · {tr(lang, 'ui.updated')} {fmtDateTime(lang, meta.asOf)}
      </span>
    </div>
  );
}

export function CompanyLogo({ symbol, logo, size = 40 }: { symbol: string; logo: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) return <AssetIcon symbol={symbol} size={size} />;
  return <img src={logo} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="shrink-0 rounded-[30%] border border-line bg-white object-contain" style={{ width: size, height: size }} />;
}

function SignalList({ items, lang }: { items: Signal[]; lang: AiLang }) {
  return (
    <ul className="space-y-1.5">
      {items.map((s, i) => {
        const Icon = s.tone === 'up' ? TrendingUp : s.tone === 'down' ? TrendingDown : Minus;
        return (
          <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug text-ink-2">
            <Icon size={15} className={cn('mt-0.5 shrink-0', s.tone === 'up' ? 'text-gain' : s.tone === 'down' ? 'text-loss' : 'text-ink-3')} />
            <span>{tr(lang, s.key, s.params)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">{children}</h4>;
}

function ChangeText({ pct, className }: { pct: number; className?: string }) {
  return <span className={cn('num font-semibold', pct >= 0 ? 'text-gain' : 'text-loss', className)}>{percent(pct)}</span>;
}

function TickerLink({ symbol, children, className }: { symbol: string; children: ReactNode; className?: string }) {
  return getAsset(symbol) ? (
    <Link to={`/markets/${symbol}`} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

/* --------------------------------- Text ----------------------------------- */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : part.replace(/(^|\s)\*(\S[^*]*\S)\*(?=\s|$|[.,;:!?])/g, '$1$2')));
}

/** Minimal, safe markdown: paragraphs, bullet lists, headings and **bold**. */
export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    out.push(
      <ul key={out.length} className="space-y-1.5 pl-1">
        {list.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            <span>{inline(l)}</span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^([•\-*]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      list.push(bullet[2]);
      continue;
    }
    flush();
    if (!line) continue;
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    out.push(
      heading ? (
        <h4 key={out.length} className="pt-1 text-[14.5px] font-semibold text-ink">
          {inline(heading[1])}
        </h4>
      ) : (
        <p key={out.length}>{inline(line)}</p>
      ),
    );
  }
  flush();
  return <div className="space-y-2.5 text-[14.5px] leading-relaxed text-ink-2">{out}</div>;
}

/* --------------------------------- Quotes --------------------------------- */

function QuoteCards({ items, lang }: { items: QuoteInfo[]; lang: AiLang }) {
  return (
    <div>
      <div className={cn('grid gap-2.5', items.length > 1 && 'sm:grid-cols-2')}>
        {items.map((q) => (
          <TickerLink key={q.symbol} symbol={q.symbol} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-2">
            <CompanyLogo symbol={q.symbol} logo={q.logo} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-semibold">{q.name}</div>
              <div className="text-[12.5px] text-ink-3">{q.symbol}</div>
            </div>
            <div className="text-right">
              <div className="num text-[15px] font-semibold">{money(q.price)}</div>
              <div className={cn('num flex items-center justify-end gap-0.5 text-[12.5px] font-semibold', q.changePct >= 0 ? 'text-gain' : 'text-loss')}>
                {q.changePct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {percent(q.changePct)}
              </div>
            </div>
          </TickerLink>
        ))}
      </div>
      <SourceLine meta={items[0].meta} lang={lang} className="mt-2 px-1" />
    </div>
  );
}

/* --------------------------------- Chart ---------------------------------- */

function ChartCard({ block, lang, convId }: { block: Extract<Block, { type: 'chart' }>; lang: AiLang; convId: string }) {
  const [loading, setLoading] = useState<AiRange | null>(null);
  const data = useAccount((s) => s.data);
  const pf = block.symbols[0] === 'PORTFOLIO';
  const s0 = block.series[0];
  const last = s0?.points[s0.points.length - 1];
  const change = s0 ? s0.points[s0.points.length - 1].v / s0.points[0].v - 1 : 0;

  async function setRange(range: AiRange) {
    if (range === block.range || loading || !data) return;
    setLoading(range);
    try {
      const next = await loadChart({ lang, provider: getProvider(), data }, block.symbols, range);
      useChat.getState().patchBlock(convId, (b) => b.type === 'chart' && b.id === block.id, () => ({ ...next, id: block.id }));
    } catch (e) {
      toast.error(tr(lang, 'e.generic', { v: e instanceof Error ? e.message : '' }));
    } finally {
      setLoading(null);
    }
  }

  return (
    <Panel>
      <div className="px-4 pt-4 sm:px-5">
        {!block.normalized && s0 && last && (
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-ink-2">{pf ? s0.label : block.symbols[0]}</div>
              <div className="num text-[24px] font-semibold leading-tight tracking-tight">{money(last.v)}</div>
            </div>
            <ChangeText pct={change} className="pb-1 text-[13.5px]" />
          </div>
        )}
        {block.normalized && <div className="mb-2 text-[12px] text-ink-3">{tr(lang, 'c.chartNorm')}</div>}
        <div className={cn('transition-opacity', loading && 'opacity-40')}>
          <SeriesChart
            series={block.series}
            normalized={block.normalized}
            formatValue={(v) => money(v)}
            formatTime={(t) => (block.range === '1D' || block.range === '1W' ? fmtDateTime(lang, t) : fmtDate(lang, t))}
            ariaLabel={`${block.symbols.join(', ')} ${block.range}`}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5 sm:px-5">
        <div className="inline-flex rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="Range">
          {AI_RANGES.map((r) => (
            <button
              key={r}
              role="radio"
              aria-checked={r === block.range}
              onClick={() => setRange(r)}
              className={cn('h-7 rounded-[9px] px-2.5 text-[12px] font-semibold transition-all', r === block.range ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2', loading === r && 'animate-pulse')}
            >
              {r}
            </button>
          ))}
        </div>
        <SourceLine meta={block.meta} lang={lang} />
      </div>
    </Panel>
  );
}

/* -------------------------------- Forecast -------------------------------- */

function ForecastCard({ f, lang }: { f: Forecast; lang: AiLang }) {
  const lo = Math.min(...f.scenarios.map((s) => s.low));
  const hi = Math.max(...f.scenarios.map((s) => s.high));
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;
  const styles = {
    bull: { bar: 'bg-gain', soft: 'bg-gain-soft', text: 'text-gain', Icon: TrendingUp },
    neutral: { bar: 'bg-ink-3', soft: 'bg-surface-2', text: 'text-ink-2', Icon: Minus },
    bear: { bar: 'bg-loss', soft: 'bg-loss-soft', text: 'text-loss', Icon: TrendingDown },
  } as const;
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex items-center gap-3">
          <AssetIcon symbol={f.symbol} size={42} />
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-brand">
              {tr(lang, 'c.scenario')} · {tr(lang, `c.horizon.${f.horizon}`)}
            </div>
            <div className="text-[15.5px] font-semibold">
              {f.name} <span className="font-normal text-ink-3">{f.symbol}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11.5px] text-ink-3">{tr(lang, 'c.price')}</div>
          <div className="num text-[17px] font-semibold">{money(f.price)}</div>
        </div>
      </div>

      <div className="mx-4 mt-4 rounded-2xl bg-surface-2 p-4 sm:mx-5">
        <div className="text-[12px] font-medium text-ink-3">{tr(lang, 'c.range')}</div>
        <div className="num mt-0.5 text-[22px] font-semibold tracking-tight">
          {money(f.rangeLow)} <span className="text-ink-3">–</span> {money(f.rangeHigh)}
        </div>
        <div className="relative mt-4 h-2 rounded-full bg-surface-3">
          {f.scenarios.map((s) => (
            <div key={s.kind} className={cn('absolute inset-y-0 opacity-80', styles[s.kind].bar, s.kind === 'bear' && 'rounded-l-full', s.kind === 'bull' && 'rounded-r-full')} style={{ left: pos(s.low), right: `calc(100% - ${pos(s.high)})` }} />
          ))}
          <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-ink shadow" style={{ left: pos(f.price) }} title={money(f.price)} />
        </div>
        <div className="num mt-1.5 flex justify-between text-[11.5px] text-ink-3">
          <span>{money(lo)}</span>
          <span>{money(hi)}</span>
        </div>
        <div className="mt-1 text-[11.5px] text-ink-3">{tr(lang, 'c.rangeNote')}</div>
      </div>

      <div className="grid gap-2.5 px-4 pt-3 sm:grid-cols-3 sm:px-5">
        {f.scenarios.map((s) => {
          const st = styles[s.kind];
          return (
            <div key={s.kind} className={cn('rounded-xl p-3', st.soft)}>
              <div className={cn('flex items-center gap-1.5 text-[12.5px] font-semibold', st.text)}>
                <st.Icon size={15} /> {tr(lang, `c.${s.kind}`)}
              </div>
              <div className="num mt-1.5 text-[14px] font-semibold text-ink">
                {money(s.low)} – {money(s.high)}
              </div>
              <div className="num mt-0.5 text-[12px] text-ink-2">
                {percent(s.low / f.price - 1, { digits: 1 })} … {percent(s.high / f.price - 1, { digits: 1 })}
              </div>
              <div className="mt-1 text-[11.5px] text-ink-3">
                ≈{Math.round(s.probability * 100)}% {tr(lang, 'c.chance')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 px-4 pt-4 sm:grid-cols-2 sm:px-5">
        <div>
          <SectionTitle>{tr(lang, 'c.why')}</SectionTitle>
          <SignalList items={f.signals} lang={lang} />
        </div>
        <div>
          <SectionTitle>{tr(lang, 'c.risks')}</SectionTitle>
          <SignalList items={f.risks} lang={lang} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line px-4 py-3 text-[12.5px] sm:px-5">
        <div>
          <div className="text-ink-3">{tr(lang, 'c.confidence')}</div>
          <div className={cn('mt-0.5 font-semibold', f.confidence === 'low' ? 'text-warn' : 'text-ink')}>{tr(lang, `c.conf.${f.confidence}`)}</div>
        </div>
        <div>
          <div className="text-ink-3">{tr(lang, 'c.quality')}</div>
          <div className={cn('mt-0.5 font-semibold', f.quality === 'good' ? 'text-ink' : 'text-warn')}>{tr(lang, `c.q.${f.quality}`)}</div>
        </div>
      </div>
      <div className="flex items-start gap-2 bg-surface-2 px-4 py-3 text-[12px] text-ink-2 sm:px-5">
        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-ink-3" />
        <div>
          {tr(lang, 'c.notGuaranteed')}
          <SourceLine meta={f.meta} lang={lang} className="mt-1.5" />
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------ Metrics table ----------------------------- */

function MetricsCard({ table, lang }: { table: MetricsTable; lang: AiLang }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-3 sm:px-5">{tr(lang, 'c.metric')}</th>
              {table.columns.map((c) => (
                <th key={c.symbol} className="px-3 py-3 text-right">
                  <div className="font-semibold">{c.symbol}</div>
                  <div className="max-w-[110px] truncate text-[11.5px] font-normal text-ink-3">{c.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.key} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2.5 text-ink-2 sm:px-5">{r.key}</td>
                {r.values.map((v, i) => (
                  <td key={i} className={cn('num px-3 py-2.5 text-right font-medium', v === null ? 'text-ink-3' : v.startsWith('+') ? 'text-gain' : v.startsWith('−') ? 'text-loss' : 'text-ink')}>
                    {v ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line px-4 py-2.5 sm:px-5">
        {table.note && <div className="mb-1.5 text-[12px] text-ink-3">{table.note}</div>}
        <SourceLine meta={table.meta} lang={lang} />
      </div>
    </Panel>
  );
}

/* ----------------------------- Company report ----------------------------- */

function Stat({ label, value, tone }: { label: string; value: string | null; tone?: 'gain' | 'loss' }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="truncate text-[11.5px] text-ink-3">{label}</div>
      <div className={cn('num mt-0.5 text-[14px] font-semibold', value === null ? 'text-ink-3' : tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink')}>{value ?? '—'}</div>
    </div>
  );
}

const big = (v: number | null) => {
  if (v === null) return null;
  const a = Math.abs(v);
  return `${v < 0 ? '−' : ''}$${a >= 1e12 ? (a / 1e12).toFixed(2) + 'T' : a >= 1e9 ? (a / 1e9).toFixed(1) + 'B' : (a / 1e6).toFixed(0) + 'M'}`;
};
const sp = (v: number | null) => (v === null ? null : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`);
const pp = (v: number | null) => (v === null ? null : `${(v * 100).toFixed(1)}%`);
const tone = (v: number | null) => (v === null ? undefined : v >= 0 ? ('gain' as const) : ('loss' as const));

function CompanyCard({ r, lang }: { r: CompanyReport; lang: AiLang }) {
  const L = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);
  const { quote: q, profile: p, indicators: ind, fundamentals: f, filings: fl } = r;
  const growth = (cur: number | null, prev: number | null) => (cur !== null && prev ? cur / prev - 1 : null);
  return (
    <Panel>
      <div className="flex items-start gap-3.5 px-4 pt-4 sm:px-5">
        <CompanyLogo symbol={r.symbol} logo={p.logo} size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-brand">{L('c.company')}</div>
          <div className="truncate text-[17px] font-semibold tracking-tight">{q.name}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] text-ink-3">
            <span className="font-semibold text-ink-2">{r.symbol}</span>
            {p.industry && <span>· {getAsset(r.symbol) && !p.meta.real ? category(lang, p.industry) : p.industry}</span>}
            {p.exchange && <span>· {p.exchange}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="num text-[18px] font-semibold">{money(q.price)}</div>
          <ChangeText pct={q.changePct} className="text-[12.5px]" />
        </div>
      </div>

      <div className="space-y-5 px-4 py-4 sm:px-5">
        {describe(lang, r.symbol, p.description) && (
          <div>
            <SectionTitle>{L('c.about')}</SectionTitle>
            <p className="text-[13.5px] leading-relaxed text-ink-2">{describe(lang, r.symbol, p.description)}</p>
          </div>
        )}

        {ind && (
          <div>
            <SectionTitle>{L('c.technical')}</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={L('m.ret1m')} value={sp(ind.ret1m)} tone={tone(ind.ret1m)} />
              <Stat label={L('m.ret3m')} value={sp(ind.ret3m)} tone={tone(ind.ret3m)} />
              <Stat label={L('m.ret1y')} value={sp(ind.ret1y)} tone={tone(ind.ret1y)} />
              <Stat label={L('m.vol')} value={`${(ind.volAnnual * 100).toFixed(0)}%`} />
              <Stat label={L('m.sma50')} value={ind.sma50 === null ? null : money(ind.sma50)} />
              <Stat label={L('m.sma200')} value={ind.sma200 === null ? null : money(ind.sma200)} />
              <Stat label={L('m.rsi')} value={ind.rsi14 === null ? null : ind.rsi14.toFixed(0)} />
              <Stat label={L('m.dd')} value={sp(ind.maxDrawdown)} tone="loss" />
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[11.5px] text-ink-3">
                <span>{money(ind.low52)}</span>
                <span>{L('m.pos52')}</span>
                <span>{money(ind.high52)}</span>
              </div>
              <div className="relative mt-1.5 h-1.5 rounded-full bg-surface-3">
                <div className="absolute inset-y-0 left-0 rounded-full bg-brand/40" style={{ width: `${ind.pos52 * 100}%` }} />
                <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand" style={{ left: `${ind.pos52 * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {f && (
          <div>
            <SectionTitle>{L('c.keyMetrics')}</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={L('m.cap')} value={big(p.marketCap)} />
              <Stat label={L('m.pe')} value={f.pe?.toFixed(1) ?? null} />
              <Stat label={L('m.eps')} value={f.eps === null ? null : money(f.eps)} />
              <Stat label={L('m.revG')} value={sp(f.revenueGrowth)} tone={tone(f.revenueGrowth)} />
              <Stat label={L('m.margin')} value={pp(f.netMargin)} />
              <Stat label={L('m.roe')} value={pp(f.roe)} />
              <Stat label={L('m.de')} value={f.debtToEquity?.toFixed(2) ?? null} />
              <Stat label={L('m.div')} value={pp(f.dividendYield)} />
            </div>
            <SourceLine meta={f.meta} lang={lang} className="mt-2" />
          </div>
        )}

        {fl && (
          <div>
            <SectionTitle>
              {L('c.financials')} · {L('m.fy', { v: fl.fiscalYear })}
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={L('m.revenue')} value={big(fl.revenue)} />
              <Stat label={`${L('m.revenue')} ${L('m.vsPrev')}`} value={sp(growth(fl.revenue, fl.revenuePrev))} tone={tone(growth(fl.revenue, fl.revenuePrev))} />
              <Stat label={L('m.netIncome')} value={big(fl.netIncome)} tone={fl.netIncome !== null && fl.netIncome < 0 ? 'loss' : undefined} />
              <Stat label={`${L('m.netIncome')} ${L('m.vsPrev')}`} value={sp(growth(fl.netIncome, fl.netIncomePrev))} tone={tone(growth(fl.netIncome, fl.netIncomePrev))} />
              <Stat label={L('m.cashEq')} value={big(fl.cash)} />
              <Stat label={L('m.ltDebt')} value={big(fl.longTermDebt)} />
              <Stat label={L('m.assets')} value={big(fl.assets)} />
              <Stat label={L('m.equity')} value={big(fl.equity)} />
            </div>
            <SourceLine meta={fl.meta} lang={lang} className="mt-2" />
          </div>
        )}

        {f && f.earnings.length > 0 && (
          <div>
            <SectionTitle>{L('c.earnings')}</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {f.earnings.map((e) => (
                <div key={e.period} className="rounded-xl bg-surface-2 px-3 py-2.5">
                  <div className="text-[11.5px] text-ink-3">{e.period}</div>
                  <div className="num mt-0.5 text-[14px] font-semibold">{e.actual === null ? '—' : money(e.actual)}</div>
                  <div className="num text-[11.5px] text-ink-3">
                    {e.estimate === null ? '' : `≈ ${money(e.estimate)}`} {e.surprisePct !== null && <span className={e.surprisePct >= 0 ? 'text-gain' : 'text-loss'}>{sp(e.surprisePct)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {r.owned && (
          <div className="flex items-center justify-between rounded-xl border border-brand/25 bg-brand-soft/50 px-3.5 py-3 text-[13.5px]">
            <span className="font-medium">
              {L('c.yourPosition')}: {fmtShares(r.owned.shares)} · {money(r.owned.value)}
            </span>
            <ChangeText pct={r.owned.pnlPct} />
          </div>
        )}

        {r.missing.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-ink-2">
            <Info size={15} className="mt-0.5 shrink-0 text-ink-3" />
            <span>
              <strong className="font-semibold">{L('c.missing')}:</strong> {r.missing.join(', ')}. {!q.meta.real && L('e.fundDemo')}
            </span>
          </div>
        )}
      </div>
      <div className="border-t border-line px-4 py-2.5 sm:px-5">
        <SourceLine meta={q.meta} lang={lang} />
      </div>
    </Panel>
  );
}

/* ------------------------------ News & events ------------------------------ */

function NewsCard({ title, items, meta, lang }: { title: string; items: NewsItem[]; meta: Meta; lang: AiLang }) {
  return (
    <Panel>
      <div className="px-4 pt-4 text-[14.5px] font-semibold sm:px-5">{title}</div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-[13.5px] text-ink-3 sm:px-5">{tr(lang, 'c.noNews')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((n, i) => (
            <li key={i}>
              <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="group block px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[14px] font-semibold leading-snug text-ink group-hover:text-brand-strong">{n.headline}</span>
                  <ExternalLink size={14} className="mt-1 shrink-0 text-ink-3" />
                </div>
                {n.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-2">{n.summary}</p>}
                <div className="mt-1.5 text-[11.5px] text-ink-3">
                  <span className="font-semibold text-ink-2">{n.source}</span> · {n.publishedAt ? fmtDateTime(lang, n.publishedAt) : '—'}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line px-4 py-2.5 sm:px-5">
        <SourceLine meta={meta} lang={lang} />
      </div>
    </Panel>
  );
}

function EventsCard({ block, lang }: { block: Extract<Block, { type: 'events' }>; lang: AiLang }) {
  return (
    <Panel>
      <div className="px-4 pt-4 text-[14.5px] font-semibold sm:px-5">{tr(lang, 'c.events')}</div>
      {block.items.length === 0 ? (
        <p className="px-4 py-4 text-[13.5px] text-ink-3 sm:px-5">{tr(lang, 'c.noEvents')}</p>
      ) : (
        <ul className="divide-y divide-line px-4 sm:px-5">
          {block.items.map((e, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5 text-[13.5px]">
              <AssetIcon symbol={e.symbol} size={32} />
              <span className="flex-1 font-semibold">{e.symbol}</span>
              {e.epsEstimate !== null && <span className="num text-ink-3">EPS ≈ {money(e.epsEstimate)}</span>}
              <span className="num text-ink-2">{fmtDate(lang, e.date)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line px-4 py-2.5 sm:px-5">
        <SourceLine meta={block.meta} lang={lang} />
      </div>
    </Panel>
  );
}

/* ---------------------------------- Picks ---------------------------------- */

export function PickCard({ p, lang, rank, footer }: { p: Pick; lang: AiLang; rank: number; footer?: ReactNode }) {
  const L = (k: string, x?: Record<string, string | number>) => tr(lang, k, x);
  return (
    <Panel className="flex flex-col">
      <div className="flex items-start gap-3 px-4 pt-4">
        <div className="relative">
          <CompanyLogo symbol={p.symbol} logo={p.logo} size={44} />
          <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10.5px] font-bold text-bg">{rank}</span>
        </div>
        <div className="min-w-0 flex-1">
          <TickerLink symbol={p.symbol} className="block truncate text-[15px] font-semibold hover:text-brand-strong">
            {p.name}
          </TickerLink>
          <div className="text-[12px] text-ink-3">
            {p.symbol} · {p.kind === 'etf' ? 'ETF' : category(lang, p.category)}
          </div>
        </div>
        <div className="text-right">
          <div className="num text-[15px] font-semibold">{money(p.price)}</div>
          <ChangeText pct={p.changePct} className="text-[12.5px]" />
        </div>
      </div>
      <div className="flex-1 space-y-3.5 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[11.5px] font-medium text-ink-3">{L('c.score')}</span>
          <div className="h-1.5 flex-1 rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-brand" style={{ width: `${p.score}%` }} />
          </div>
          <span className="num text-[12.5px] font-semibold">{p.score}/100</span>
        </div>
        <p className="text-[13px] leading-snug text-ink-2">{describe(lang, p.symbol, p.overview)}</p>
        {p.reasons.length > 0 && (
          <div>
            <SectionTitle>{L('c.whySelected')}</SectionTitle>
            <SignalList items={p.reasons} lang={lang} />
          </div>
        )}
        {p.opportunities.length > 0 && (
          <div>
            <SectionTitle>{L('c.opps')}</SectionTitle>
            <SignalList items={p.opportunities} lang={lang} />
          </div>
        )}
        <div>
          <SectionTitle>{L('c.risks')}</SectionTitle>
          <SignalList items={p.risks} lang={lang} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.metrics.map((m) => (
            <span key={m.key} className="rounded-lg bg-surface-2 px-2 py-1 text-[11.5px] text-ink-2">
              {L(m.key)} <span className="num font-semibold text-ink">{m.value}</span>
            </span>
          ))}
        </div>
        {p.ownedWeight !== null && <div className="rounded-lg bg-brand-soft px-2.5 py-1.5 text-[12px] font-medium text-brand-strong">{L('c.owned', { v: (p.ownedWeight * 100).toFixed(1) })}</div>}
      </div>
      <div className="border-t border-line px-4 py-2.5">
        <SourceLine meta={{ ...p.meta, source: p.sources.join(' + ') }} lang={lang} />
        {footer && <div className="mt-2.5">{footer}</div>}
      </div>
    </Panel>
  );
}

function PicksBlock({ block, lang }: { block: Extract<Block, { type: 'picks' }>; lang: AiLang }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="text-[14.5px] font-semibold">
          {tr(lang, 'c.picks')} · {tr(lang, `c.h.${block.horizon}`)}
        </span>
        <Link to="/ai/picks" className="text-[12.5px] font-semibold text-brand hover:text-brand-strong">
          {tr(lang, 'ui.tab.picks')} →
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {block.items.map((p, i) => (
          <PickCard key={p.symbol} p={p} lang={lang} rank={i + 1} />
        ))}
      </div>
      <p className="mt-2 flex items-start gap-1.5 px-1 text-[12px] text-ink-3">
        <ShieldAlert size={13} className="mt-0.5 shrink-0" /> {tr(lang, 'c.picksNote')}
      </p>
    </div>
  );
}

/* -------------------------------- Portfolio -------------------------------- */

const BAR_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];

function Bars({ rows }: { rows: { label: string; value: number; sub?: string; color: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2.5 text-[13px]">
          <span className="w-[74px] shrink-0 truncate font-semibold">{r.label}</span>
          <div className="h-2.5 flex-1 rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color }} />
          </div>
          <span className="num w-11 text-right font-semibold">{(r.value * 100).toFixed(0)}%</span>
          <span className="num hidden w-20 text-right text-ink-3 sm:block">{r.sub ?? ''}</span>
        </li>
      ))}
    </ul>
  );
}

function PortfolioCard({ a, lang }: { a: PortfolioAnalysis; lang: AiLang }) {
  const L = (k: string) => tr(lang, k);
  const top = a.positions.slice(0, 6);
  const other = a.positions.slice(6).reduce((s, p) => s + p.weight, 0);
  const alloc = [...top.map((p, i) => ({ label: p.symbol, value: p.weight, sub: money(p.value, { compact: true }), color: BAR_COLORS[i] })), ...(other > 0 ? [{ label: lang === 'ru' ? 'Другие' : 'Other', value: other, color: 'var(--series-other)' }] : []), { label: lang === 'ru' ? 'Деньги' : 'Cash', value: a.cashWeight, sub: money(a.cash, { compact: true }), color: 'var(--series-cash)' }];
  const risk = [...a.positions].sort((x, y) => y.riskShare - x.riskShare).slice(0, 6);
  const concTone = a.concentration === 'high' ? 'bg-loss-soft text-loss' : a.concentration === 'moderate' ? 'bg-warn-soft text-warn' : 'bg-gain-soft text-gain';
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-brand">{L('c.portfolio')}</div>
        <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-semibold', concTone)}>{L(`c.conc.${a.concentration}`)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pt-3 sm:grid-cols-4 sm:px-5">
        <Stat label={L('c.total')} value={money(a.total)} />
        <Stat label={L('c.invested')} value={money(a.invested)} />
        <Stat label={L('c.cash')} value={money(a.cash)} />
        <Stat label={L('c.return')} value={`${money(a.totalReturn, { sign: true })} (${percent(a.totalReturnPct)})`} tone={a.totalReturn >= 0 ? 'gain' : 'loss'} />
      </div>
      <div className="grid gap-5 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <div>
          <SectionTitle>{L('c.allocation')}</SectionTitle>
          <Bars rows={alloc} />
        </div>
        {risk.length > 0 && (
          <div>
            <SectionTitle>{L('c.riskAlloc')}</SectionTitle>
            <Bars rows={risk.map((p) => ({ label: p.symbol, value: p.riskShare, sub: `σ ${(p.vol * 100).toFixed(0)}%`, color: p.riskShare > p.weight / Math.max(0.0001, 1 - a.cashWeight) + 0.03 ? 'rgb(var(--loss))' : 'rgb(var(--ink-3))' }))} />
            <p className="mt-2 text-[11.5px] leading-snug text-ink-3">{L('c.riskNote')}</p>
          </div>
        )}
        {a.sectors.length > 0 && (
          <div className="sm:col-span-2">
            <SectionTitle>{L('c.sectors')}</SectionTitle>
            <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
              {a.sectors.map((s, i) => (
                <div key={s.name} style={{ width: `${s.weight * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length], minWidth: 3 }} title={`${category(lang, s.name)} ${(s.weight * 100).toFixed(0)}%`} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {a.sectors.map((s, i) => (
                <span key={s.name} className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                  {category(lang, s.name)} <span className="num font-semibold text-ink">{(s.weight * 100).toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {a.strengths.length > 0 && (
          <div>
            <SectionTitle>{L('c.strengths')}</SectionTitle>
            <SignalList items={a.strengths} lang={lang} />
          </div>
        )}
        {a.weaknesses.length > 0 && (
          <div>
            <SectionTitle>{L('c.weaknesses')}</SectionTitle>
            <SignalList items={a.weaknesses} lang={lang} />
          </div>
        )}
        {a.ideas.length > 0 && (
          <div className="sm:col-span-2">
            <SectionTitle>{L('c.ideas')}</SectionTitle>
            <SignalList items={a.ideas} lang={lang} />
          </div>
        )}
      </div>
      <div className="border-t border-line px-4 py-2.5 sm:px-5">
        <SourceLine meta={a.meta} lang={lang} />
      </div>
    </Panel>
  );
}

function AccountCard({ b, lang }: { b: Extract<Block, { type: 'account' }>; lang: AiLang }) {
  return (
    <Panel>
      <div className="px-4 pt-4 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-brand sm:px-5">{tr(lang, 'c.account')}</div>
      <div className="grid grid-cols-3 gap-2 px-4 py-3 sm:px-5">
        <Stat label={tr(lang, 'c.cash')} value={money(b.cash)} />
        <Stat label={tr(lang, 'c.invested')} value={money(b.invested)} />
        <Stat label={tr(lang, 'c.total')} value={money(b.total)} />
      </div>
      {b.positions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-5">
          {b.positions.map((p) => (
            <Link key={p.symbol} to={`/markets/${p.symbol}`} className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12px] hover:bg-surface-3">
              <span className="font-semibold">{p.symbol}</span> <span className="num text-ink-2">{money(p.value, { compact: true })}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="border-t border-line px-4 py-2.5 sm:px-5">
        <SourceLine meta={b.meta} lang={lang} />
      </div>
    </Panel>
  );
}

function WhatIfCard({ b, lang }: { b: Extract<Block, { type: 'whatif' }>; lang: AiLang }) {
  const d = b.data;
  return (
    <Panel>
      <div className="px-4 pt-4 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-brand sm:px-5">{tr(lang, 'c.whatif')}</div>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <div className="flex-1 rounded-xl bg-surface-2 p-3">
          <div className="text-[11.5px] text-ink-3">{tr(lang, 'c.before')}</div>
          <div className="num text-[16px] font-semibold">{money(d.before)}</div>
        </div>
        <span className="text-ink-3">→</span>
        <div className={cn('flex-1 rounded-xl p-3', d.delta < 0 ? 'bg-loss-soft' : d.delta > 0 ? 'bg-gain-soft' : 'bg-surface-2')}>
          <div className="text-[11.5px] text-ink-3">{tr(lang, 'c.after')}</div>
          <div className="num text-[16px] font-semibold">{money(d.after)}</div>
          <div className={cn('num text-[12.5px] font-semibold', d.delta < 0 ? 'text-loss' : 'text-gain')}>
            {money(d.delta, { sign: true })} ({percent(d.deltaPct)})
          </div>
        </div>
      </div>
      <ul className="divide-y divide-line border-t border-line px-4 sm:px-5">
        {d.changes.map((c) => (
          <li key={c.symbol} className="flex items-center gap-3 py-2.5 text-[13.5px]">
            <AssetIcon symbol={c.symbol} size={30} />
            <span className="font-semibold">{c.symbol}</span>
            <span className={cn('num font-semibold', c.pct < 0 ? 'text-loss' : 'text-gain')}>
              {c.pct >= 0 ? '+' : '−'}
              {Math.abs(c.pct)}%
            </span>
            <span className="num ml-auto text-ink-2">{c.held ? `${tr(lang, 'c.impact')}: ${money(c.impact, { sign: true })}` : tr(lang, 'c.notHeld')}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-4 py-2.5 sm:px-5">
        <SourceLine meta={d.meta} lang={lang} />
      </div>
    </Panel>
  );
}

/* ----------------------------- Trade confirmation --------------------------- */

function TradeCard({ p, lang, convId }: { p: TradeProposal; lang: AiLang; convId: string }) {
  const L = (k: string, x?: Record<string, string | number>) => tr(lang, k, x);
  const now = useNow();
  const trade = useAccount((s) => s.trade);
  const cash = useAccount((s) => s.data?.account.cash ?? 0);
  const patch = (next: Partial<TradeProposal>) => useChat.getState().patchBlock(convId, (b) => b.type === 'trade' && b.proposal.id === p.id, (b) => (b.type === 'trade' ? { ...b, proposal: { ...b.proposal, ...next } } : b));
  const pending = p.status === 'pending' || p.status === 'executing';
  // While the order is open the estimate follows the live simulated price.
  const price = pending ? priceAt(p.symbol, now) : p.result?.price ?? p.estPrice;
  const qty = p.result?.shares ?? p.shares ?? (p.amount ?? 0) / price;
  const total = p.result?.amount ?? p.amount ?? qty * price;
  const cashAfter = p.result?.cashAfter ?? (p.side === 'buy' ? cash - total : cash + total);

  async function confirm() {
    if (p.status !== 'pending') return;
    patch({ status: 'executing' });
    try {
      const tx = await trade(p.shares !== undefined ? { side: p.side, symbol: p.symbol, shares: p.shares } : { side: p.side, symbol: p.symbol, amount: p.amount });
      patch({ status: 'done', result: tx });
    } catch (e) {
      patch({ status: 'failed', error: e instanceof TradeError ? e.message : 'Order failed.' });
    }
  }

  const Row = ({ k, v }: { k: string; v: ReactNode }) => (
    <div className="flex items-center justify-between py-2 text-[13.5px]">
      <span className="text-ink-2">{k}</span>
      <span className="num font-semibold text-ink">{v}</span>
    </div>
  );

  return (
    <Panel className={cn(p.status === 'pending' && 'border-brand/40 shadow-[0_0_0_4px_rgb(var(--brand)/0.08)]')}>
      <div className="flex items-center gap-3 px-4 pt-4 sm:px-5">
        <AssetIcon symbol={p.symbol} size={42} />
        <div className="flex-1">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-brand">{L(`c.trade.title.${p.side}`)}</div>
          <div className="text-[15.5px] font-semibold">
            {p.name} <span className="font-normal text-ink-3">{p.symbol}</span>
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-bold uppercase', p.side === 'buy' ? 'bg-brand-soft text-brand-strong' : 'bg-surface-3 text-ink')}>{p.side === 'buy' ? (lang === 'ru' ? 'Покупка' : 'Buy') : lang === 'ru' ? 'Продажа' : 'Sell'}</span>
      </div>
      <div className="mx-4 mt-3 divide-y divide-line rounded-xl border border-line px-3.5 sm:mx-5">
        <Row k={L('c.trade.qty')} v={`${fmtShares(qty)} ${L('c.trade.shares')}`} />
        <Row k={L('c.trade.price')} v={money(price)} />
        <Row k={L(`c.trade.total.${p.side}`)} v={money(total)} />
        <Row k={L('c.trade.cashAfter')} v={money(cashAfter)} />
      </div>

      {pending && (
        <div className="px-4 pb-4 pt-3 sm:px-5">
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" size="lg" disabled={p.status === 'executing'} onClick={() => patch({ status: 'cancelled' })}>
              {L('c.trade.cancel')}
            </Button>
            <Button size="lg" variant={p.side === 'buy' ? 'primary' : 'sell'} loading={p.status === 'executing'} onClick={confirm}>
              {p.status === 'executing' ? L('c.trade.executing') : L('c.trade.confirm')}
            </Button>
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-3">
            <FlaskConical size={12} className="mt-0.5 shrink-0" /> {L('c.trade.note')}
          </p>
        </div>
      )}
      {p.status === 'done' && p.result && (
        <div className="m-4 flex items-center gap-2.5 rounded-xl bg-gain-soft px-3.5 py-3 text-[13.5px] font-semibold text-gain sm:mx-5">
          <Check size={18} strokeWidth={3} /> {L(`c.trade.done.${p.side}`, { q: fmtShares(p.result.shares ?? 0), s: p.symbol, t: money(p.result.amount) })}
        </div>
      )}
      {p.status === 'cancelled' && (
        <div className="m-4 flex items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[13.5px] text-ink-2 sm:mx-5">
          <X size={17} /> {L('c.trade.cancelled')}
        </div>
      )}
      {p.status === 'failed' && (
        <div className="m-4 flex items-center gap-2.5 rounded-xl bg-loss-soft px-3.5 py-3 text-[13.5px] text-loss sm:mx-5">
          <CircleAlert size={17} /> {p.error}
        </div>
      )}
    </Panel>
  );
}

/* --------------------------------- Renderer -------------------------------- */

export function BlockView({ block, lang, convId }: { block: Block; lang: AiLang; convId: string }) {
  switch (block.type) {
    case 'text':
      return <RichText text={block.text} />;
    case 'notice': {
      const Icon = block.tone === 'error' ? CircleAlert : block.tone === 'warning' ? AlertTriangle : Info;
      return (
        <div className={cn('flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13.5px] leading-snug', block.tone === 'error' ? 'bg-loss-soft text-loss' : block.tone === 'warning' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-2')} role={block.tone === 'error' ? 'alert' : 'status'}>
          <Icon size={17} className="mt-0.5 shrink-0" />
          <span>{block.text}</span>
        </div>
      );
    }
    case 'quotes':
      return <QuoteCards items={block.items} lang={lang} />;
    case 'chart':
      return <ChartCard block={block} lang={lang} convId={convId} />;
    case 'metrics':
      return <MetricsCard table={block.table} lang={lang} />;
    case 'forecast':
      return <ForecastCard f={block.data} lang={lang} />;
    case 'company':
      return <CompanyCard r={block.data} lang={lang} />;
    case 'news':
      return <NewsCard title={block.title} items={block.items} meta={block.meta} lang={lang} />;
    case 'events':
      return <EventsCard block={block} lang={lang} />;
    case 'picks':
      return <PicksBlock block={block} lang={lang} />;
    case 'portfolio':
      return <PortfolioCard a={block.data} lang={lang} />;
    case 'account':
      return <AccountCard b={block} lang={lang} />;
    case 'whatif':
      return <WhatIfCard b={block} lang={lang} />;
    case 'trade':
      return <TradeCard p={block.proposal} lang={lang} convId={convId} />;
  }
}

export { Sparkles };
