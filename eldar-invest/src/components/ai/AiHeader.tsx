import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FlaskConical, Info, Signal, Sparkles } from 'lucide-react';
import { tr } from '@/ai/i18n';
import { getProvider, useBackend } from '@/ai/provider';
import { useChat } from '@/ai/store';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

/** Title, mode badges, language switch and the Chat / Stock Picks tabs. */
export function AiHeader({ actions }: { actions?: React.ReactNode }) {
  const lang = useChat((s) => s.lang);
  const setLang = useChat((s) => s.setLang);
  const info = useBackend((s) => s.info);
  const [open, setOpen] = useState(false);
  const gemini = !!info?.ai.enabled;
  const real = getProvider().real;
  const L = (k: string) => tr(lang, k);

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#19c37d,#0a7a4b)] text-white shadow-card">
          <Sparkles size={20} />
        </span>
        <div className="mr-auto min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">ELDAR AI</h1>
          <button onClick={() => setOpen(true)} className="flex flex-wrap items-center gap-x-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2" aria-label={L('ui.setup.title')}>
            <span className={cn('inline-flex items-center gap-1', gemini && 'text-brand-strong')}>
              <Sparkles size={11} /> {L(gemini ? 'ui.mode.gemini' : 'ui.mode.local')}
            </span>
            <span>·</span>
            <span className={cn('inline-flex items-center gap-1', real ? 'text-gain' : 'text-warn')}>
              {real ? <Signal size={11} /> : <FlaskConical size={11} />} {L(real ? 'ui.data.real' : 'ui.data.demo')}
            </span>
            <Info size={12} />
          </button>
        </div>
        <div className="inline-flex rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="Language">
          {(['ru', 'en'] as const).map((l) => (
            <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={cn('h-8 rounded-[9px] px-2.5 text-[12px] font-bold uppercase transition-all', lang === l ? 'bg-surface text-ink shadow-card' : 'text-ink-3')}>
              {l}
            </button>
          ))}
        </div>
        {actions}
      </div>
      <div className="mt-4 flex gap-1 border-b border-line" role="tablist">
        {[
          { to: '/ai', label: L('ui.tab.chat'), end: true },
          { to: '/ai/picks', label: L('ui.tab.picks'), end: false },
        ].map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} role="tab" className={({ isActive }) => cn('-mb-px border-b-2 px-3.5 pb-2.5 text-[14px] font-semibold transition-colors', isActive ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink-2')}>
            {t.label}
          </NavLink>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={L('ui.setup.title')}>
        <div className="space-y-3 px-6 pb-6 pt-2 text-[13.5px] leading-relaxed text-ink-2">
          <ul className="space-y-2">
            <li className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5">
              <span>{lang === 'ru' ? 'Языковая модель' : 'Language model'}</span>
              <strong className="text-ink">{gemini ? `Gemini · ${info?.ai.model}` : L('ui.mode.local')}</strong>
            </li>
            {(['quotes', 'history', 'fundamentals', 'filings', 'news'] as const).map((k) => (
              <li key={k} className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5">
                <span>{{ quotes: lang === 'ru' ? 'Котировки' : 'Quotes', history: lang === 'ru' ? 'История цен' : 'Price history', fundamentals: lang === 'ru' ? 'Показатели компаний' : 'Company metrics', filings: lang === 'ru' ? 'Годовая отчётность' : 'Annual reports', news: lang === 'ru' ? 'Новости и события' : 'News and events' }[k]}</span>
                <strong className={info?.market[k] ? 'text-gain' : 'text-warn'}>{info?.market[k] ?? (k === 'quotes' || k === 'history' ? L('ui.data.demo') : L('c.missing'))}</strong>
              </li>
            ))}
          </ul>
          {(!gemini || !real) && <p>{L('ui.setup.body')}</p>}
          <p className="text-[12.5px] text-ink-3">{L('ui.disclaimer')}</p>
        </div>
      </Modal>
    </div>
  );
}
