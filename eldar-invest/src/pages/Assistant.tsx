import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, BarChart3, Briefcase, FileSearch, GitCompareArrows, History, Lightbulb, MessageSquarePlus, ShoppingCart, Sparkles, Telescope, Trash2 } from 'lucide-react';
import { sendMessage } from '@/ai/engine';
import { tr } from '@/ai/i18n';
import { getProvider, useBackend } from '@/ai/provider';
import { useChat } from '@/ai/store';
import type { ChatMessage, Conversation } from '@/ai/types';
import { AiHeader } from '@/components/ai/AiHeader';
import { BlockView } from '@/components/ai/blocks';
import { IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import { useAccount } from '@/stores/account';

const STARTERS = [
  { icon: FileSearch, cat: 'ui.cat.analyze', prompt: 'sg.analyze' },
  { icon: Telescope, cat: 'ui.cat.forecast', prompt: 'sg.forecast' },
  { icon: GitCompareArrows, cat: 'ui.cat.compare', prompt: 'sg.compare' },
  { icon: Lightbulb, cat: 'ui.cat.picks', prompt: 'sg.picks' },
  { icon: Briefcase, cat: 'ui.cat.portfolio', prompt: 'sg.portfolio' },
  { icon: ShoppingCart, cat: 'ui.cat.trade', prompt: 'sg.trade' },
];

function HistoryList({ onPick }: { onPick?: () => void }) {
  const lang = useChat((s) => s.lang);
  const list = useChat((s) => s.conversations).filter((c) => c.messages.length);
  const activeId = useChat((s) => s.activeId);
  const open = useChat((s) => s.open);
  const remove = useChat((s) => s.remove);
  if (!list.length) return <p className="px-3 py-6 text-center text-[13px] text-ink-3">{tr(lang, 'ui.noHistory')}</p>;
  return (
    <ul className="space-y-1">
      {list.map((c: Conversation) => (
        <li key={c.id} className={cn('group flex items-center rounded-xl transition-colors', c.id === activeId ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
          <button
            className="min-w-0 flex-1 px-3 py-2.5 text-left"
            onClick={() => {
              open(c.id);
              onPick?.();
            }}
          >
            <div className={cn('truncate text-[13.5px] font-medium', c.id === activeId ? 'text-brand-strong' : 'text-ink')}>{c.title || '…'}</div>
            <div className="text-[11.5px] text-ink-3">{relativeTime(c.updatedAt)}</div>
          </button>
          <button onClick={() => remove(c.id)} className="mr-1 rounded-lg p-2 text-ink-3 opacity-60 hover:bg-surface-3 hover:text-loss group-hover:opacity-100" aria-label={tr(lang, 'ui.delete')}>
            <Trash2 size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Message({ m, convId, isLast, onSuggest }: { m: ChatMessage; convId: string; isLast: boolean; onSuggest: (t: string) => void }) {
  const lang = useChat((s) => s.lang);
  const busy = useChat((s) => s.busy);
  if (m.role === 'user') {
    const b = m.blocks[0];
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[14.5px] leading-relaxed text-brand-ink shadow-card">{b?.type === 'text' ? b.text : ''}</div>
      </div>
    );
  }
  const thinking = isLast && busy;
  return (
    <div className="animate-rise" data-testid="ai-message">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-ink-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#19c37d,#0a7a4b)] text-white">
          <Sparkles size={13} />
        </span>
        ELDAR AI
        {m.engine && !thinking && <span className="font-normal">· {tr(lang, m.engine === 'gemini' ? 'ui.mode.gemini' : 'ui.mode.local')}</span>}
      </div>
      <div className="space-y-3">
        {m.blocks.map((b, i) => (
          <BlockView key={i} block={b} lang={lang} convId={convId} />
        ))}
        {thinking && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] text-ink-2" role="status">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            {tr(lang, 'ui.thinking')}…
          </div>
        )}
      </div>
      {isLast && !busy && m.suggestions && m.suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {m.suggestions.map((s) => (
            <button key={s} onClick={() => onSuggest(s)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-strong">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Assistant() {
  const uid = useAccount((s) => s.data!.profile.uid);
  const firstName = useAccount((s) => s.data!.profile.name.split(' ')[0]);
  const lang = useChat((s) => s.lang);
  const busy = useChat((s) => s.busy);
  const conv = useChat((s) => s.conversations.find((c) => c.id === s.activeId));
  const newChat = useChat((s) => s.newChat);
  const backendState = useBackend((s) => s.state);
  const [text, setText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const L = (k: string) => tr(lang, k);
  const real = getProvider().real;

  useEffect(() => {
    useChat.getState().load(uid);
    void useBackend.getState().check();
  }, [uid]);

  // A prompt handed over from another screen (e.g. Stock Picks → "Ask ELDAR AI").
  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt;
    if (!prompt || backendState === 'unknown' || backendState === 'checking') return;
    navigate('/ai', { replace: true, state: null });
    useChat.getState().newChat();
    void sendMessage(prompt);
  }, [location.state, backendState, navigate]);

  const blockCount = conv?.messages.reduce((n, m) => n + m.blocks.length, 0) ?? 0;
  const toBottom = (behavior: ScrollBehavior) => window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
  // New content: follow it smoothly.
  useLayoutEffect(() => {
    if (conv?.messages.length) toBottom('smooth');
  }, [blockCount, busy, conv?.messages.length]);
  // Opening a conversation: jump straight to its end, again once charts have sized themselves.
  useEffect(() => {
    if (!conv?.id) return;
    toBottom('auto');
    const timers = [80, 400].map((ms) => setTimeout(() => toBottom('auto'), ms));
    return () => timers.forEach(clearTimeout);
  }, [conv?.id]);

  function submit(value = text) {
    const v = value.trim();
    if (!v || busy) return;
    setText('');
    if (input.current) input.current.style.height = 'auto';
    void sendMessage(v);
  }

  const messages = conv?.messages ?? [];

  return (
    <div className="mx-auto flex max-w-6xl gap-8">
      <aside className="sticky top-24 hidden h-[calc(100dvh-8rem)] w-64 shrink-0 flex-col xl:flex">
        <button onClick={newChat} className="mb-3 flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[13.5px] font-semibold shadow-card transition-colors hover:bg-surface-2">
          <MessageSquarePlus size={17} /> {L('ui.new')}
        </button>
        <div className="eyebrow px-3 pb-1.5">{L('ui.history')}</div>
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <HistoryList />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl">
          <AiHeader
            actions={
              <div className="flex gap-1 xl:hidden">
                <IconButton label={L('ui.history')} onClick={() => setHistoryOpen(true)} className="border border-line">
                  <History size={18} />
                </IconButton>
                <IconButton label={L('ui.new')} onClick={newChat} className="border border-line">
                  <MessageSquarePlus size={18} />
                </IconButton>
              </div>
            }
          />

          {messages.length === 0 ? (
            <div className="animate-rise pb-6 pt-4 sm:pt-8">
              <h2 className="text-[24px] font-semibold tracking-tight sm:text-[28px]">
                {lang === 'ru' ? `Здравствуйте, ${firstName}.` : `Hello, ${firstName}.`} <span className="text-ink-3">{L('ui.hello')}</span>
              </h2>
              <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-ink-2">{L('ui.helloSub')}</p>
              <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {STARTERS.map((s) => (
                  <button key={s.prompt} onClick={() => submit(L(s.prompt))} className="card group flex flex-col items-start gap-2 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift sm:p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <s.icon size={18} />
                    </span>
                    <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{L(s.cat)}</span>
                    <span className="text-[13.5px] font-medium leading-snug text-ink">{L(s.prompt)}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {['sg.news', 'sg.cash', 'sg.whatif', 'sg.pfChart', 'sg.longPicks'].map((k) => (
                  <button key={k} onClick={() => submit(L(k))} className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-strong">
                    {L(k)}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-[12px] leading-relaxed text-ink-3">{L('ui.disclaimer')}</p>
              {!real && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-soft px-3.5 py-3 text-[12.5px] leading-snug text-warn">
                  <BarChart3 size={15} className="mt-0.5 shrink-0" /> {L('ui.demoNote')}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6 pb-4 pt-2" aria-live="polite">
              {messages.map((m, i) => (
                <Message key={m.id} m={m} convId={conv!.id} isLast={i === messages.length - 1} onSuggest={submit} />
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="sticky bottom-[76px] z-20 pt-2 lg:bottom-4">
            <div className="pointer-events-none absolute inset-x-0 -top-6 bottom-0 bg-gradient-to-t from-bg via-bg/95 to-transparent" />
            <div className="relative flex items-end gap-2 rounded-[22px] border border-line bg-surface p-2 shadow-lift transition-[border-color,box-shadow] focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgb(var(--brand)/0.12),0_4px_12px_-2px_rgb(16_24_40/0.08)]">
              <textarea
                ref={input}
                rows={1}
                value={text}
                maxLength={2000}
                placeholder={L('ui.placeholder')}
                aria-label={L('ui.placeholder')}
                onChange={(e) => {
                  setText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                className="max-h-[140px] min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-ink-3"
              />
              <button onClick={() => submit()} disabled={!text.trim() || busy} aria-label={L('ui.send')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-ink transition-all hover:bg-brand-strong active:scale-95 disabled:bg-surface-3 disabled:text-ink-3">
                <ArrowUp size={20} strokeWidth={2.5} />
              </button>
            </div>
            <p className="relative mt-1.5 pb-1 text-center text-[11px] leading-snug text-ink-3">{L('ui.short')}</p>
          </div>
        </div>
      </div>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={L('ui.history')}>
        <div className="max-h-[60dvh] overflow-y-auto px-3 pb-4">
          <HistoryList onPick={() => setHistoryOpen(false)} />
        </div>
      </Modal>
    </div>
  );
}
