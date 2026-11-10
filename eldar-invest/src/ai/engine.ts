/**
 * Conversation engine.
 *
 *  Gemini mode  → the server proxies to Gemini; the model decides which tools
 *                 to call, the app executes them and returns compact results.
 *  Local mode   → the built-in analyst maps the message to a tool directly.
 *
 * Both modes run the same tools and render the same cards. If Gemini is
 * rate-limited or unreachable, the turn falls back to the built-in analyst.
 */
import { AI_TOOL_NAMES } from '@shared/aiTools';
import { summarize } from '@/domain/account';
import { uid } from '@/domain/ids';
import { useAccount } from '@/stores/account';
import { detectLang, tr } from './i18n';
import { parseIntent } from './intent';
import { AiError, api, geminiAvailable, getProvider, useBackend } from './provider';
import { useChat } from './store';
import { runTool, type ToolContext } from './tools';
import type { AiLang, Block, ChatMessage, WireContent } from './types';

const MAX_ROUNDS = 5;

function accountSnapshot(): string {
  const data = useAccount.getState().data;
  if (!data) return 'unavailable';
  const s = summarize(data, Date.now());
  return JSON.stringify({
    prices: 'ELDAR INVEST simulated',
    cash: +s.cash.toFixed(2),
    total_value: +s.total.toFixed(2),
    total_return_pct: +(s.totalReturnPct * 100).toFixed(2),
    holdings: s.positions.map((p) => ({ symbol: p.symbol, shares: p.shares, avg_cost: +p.avgCost.toFixed(2), value: +p.value.toFixed(2), weight_pct: +(p.weight * 100).toFixed(1), pnl_pct: +(p.pnlPct * 100).toFixed(1) })),
    watchlist: data.watchlist,
  });
}

function capabilities(): string {
  const p = getProvider();
  const info = useBackend.getState().info?.market;
  if (!p.real) return 'Simulated prices and charts for the 34 catalogue tickers only. No real news, events, financial statements or valuation metrics.';
  return `Quotes: ${info?.quotes}. Price history: ${info?.history ?? 'unavailable'}. Metrics and earnings: ${info?.fundamentals ?? 'unavailable'}. Annual reports: ${info?.filings ?? 'unavailable'}. News and earnings calendar: ${info?.news ?? 'unavailable'}.`;
}

interface AiResponse {
  parts: Record<string, unknown>[];
  blocked?: string;
  model?: string;
}

async function geminiTurn(convId: string, messageId: string, lang: AiLang, ctx: ToolContext): Promise<string[] | undefined> {
  const chat = useChat.getState;
  let suggestions: string[] | undefined;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const conv = chat().conversations.find((c) => c.id === convId)!;
    const res = await api<AiResponse>('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: conv.wire, context: { lang, dataMode: ctx.provider.real ? 'real' : 'demo', capabilities: capabilities(), portfolio: accountSnapshot(), focus: conv.focus.join(', ') } }),
    });
    if (!res.parts.length) throw new AiError('ai_empty', res.blocked ?? 'empty');
    const calls = res.parts.filter((p) => p.functionCall) as { functionCall: { name: string; args?: Record<string, unknown>; id?: string } }[];
    const text = res.parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text as string).join('').trim();
    // Model parts are stored verbatim: newer Gemini models require their thought signatures to be echoed back.
    chat().update(convId, (c) => ({ ...c, wire: [...c.wire, { role: 'model', parts: res.parts }] }));
    if (!calls.length) {
      if (text) chat().appendBlocks(convId, messageId, [{ type: 'text', text }]);
      return suggestions;
    }
    const responses: Record<string, unknown>[] = [];
    for (const call of calls.slice(0, 4)) {
      const name = call.functionCall.name;
      const out = AI_TOOL_NAMES.includes(name) ? await runTool({ ...ctx, data: useAccount.getState().data ?? ctx.data }, name, call.functionCall.args ?? {}) : { blocks: [] as Block[], result: { error: 'unknown tool' }, summary: '' };
      if (out.blocks.length) chat().appendBlocks(convId, messageId, out.blocks);
      if (out.focus?.length) chat().update(convId, (c) => ({ ...c, focus: out.focus! }));
      suggestions = out.suggestions ?? suggestions;
      responses.push({ functionResponse: { name, response: out.result, ...(call.functionCall.id ? { id: call.functionCall.id } : {}) } });
    }
    chat().update(convId, (c) => ({ ...c, wire: [...c.wire, { role: 'user', parts: responses }] }));
  }
  return suggestions;
}

async function localTurn(convId: string, messageId: string, text: string, ctx: ToolContext): Promise<string[] | undefined> {
  const chat = useChat.getState;
  const conv = chat().conversations.find((c) => c.id === convId)!;
  const intent = parseIntent(text, conv.focus, ctx.provider.real);
  if (intent.tool === 'help') {
    const key = { greeting: 's.help', unknown: 's.unknown', need_symbol: 'e.needSymbol', need_amount: 'e.needAmount' }[intent.args.reason];
    chat().appendBlocks(convId, messageId, [{ type: 'text', text: tr(ctx.lang, key) }]);
    return [tr(ctx.lang, 'sg.analyze'), tr(ctx.lang, 'sg.picks'), tr(ctx.lang, 'sg.portfolio')];
  }
  const out = await runTool(ctx, intent.tool, intent.args as Record<string, unknown>);
  const blocks: Block[] = [...out.blocks];
  // Lead with the explanation, then the cards (confirmation cards stay last so the buttons are near the input).
  if (out.summary) intent.tool === 'propose_trade' ? blocks.unshift({ type: 'text', text: out.summary }) : blocks.unshift({ type: 'text', text: out.summary });
  chat().appendBlocks(convId, messageId, blocks);
  if (out.focus?.length) chat().update(convId, (c) => ({ ...c, focus: out.focus! }));
  // Keep the model context in sync so a later Gemini turn knows what was shown.
  chat().update(convId, (c) => ({ ...c, wire: [...c.wire, { role: 'model', parts: [{ text: `[Built-in analyst ran ${intent.tool}] ${JSON.stringify(out.result).slice(0, 3000)}` }] }] }));
  return out.suggestions;
}

/** Handles one user message end to end. Never throws. */
export async function sendMessage(text: string): Promise<void> {
  const chat = useChat.getState();
  const data = useAccount.getState().data;
  const clean = text.trim().slice(0, 2000);
  if (!clean || chat.busy || !data) return;
  const conv = chat.ensure();
  const lang = detectLang(clean) ?? chat.lang;
  chat.setBusy(true);
  const user: ChatMessage = { id: uid('m_'), role: 'user', blocks: [{ type: 'text', text: clean }], at: Date.now() };
  chat.addMessage(conv.id, user);
  const userWire: WireContent = { role: 'user', parts: [{ text: clean }] };
  chat.update(conv.id, (c) => ({ ...c, wire: [...c.wire, userWire], lang }));
  const useGemini = geminiAvailable();
  const reply: ChatMessage = { id: uid('m_'), role: 'assistant', blocks: [], at: Date.now(), engine: useGemini ? 'gemini' : 'local' };
  chat.addMessage(conv.id, reply);
  const ctx: ToolContext = { lang, provider: getProvider(), data };
  let suggestions: string[] | undefined;
  try {
    if (useGemini) {
      try {
        suggestions = await geminiTurn(conv.id, reply.id, lang, ctx);
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError('error', String(e));
        console.warn('[ELDAR AI] Gemini turn failed:', err.code);
        const rate = err.code === 'ai_rate_limited' || err.code === 'rate_limited';
        const shown = useChat.getState().conversations.find((c) => c.id === conv.id)?.messages.find((m) => m.id === reply.id)?.blocks.length ?? 0;
        useChat.getState().appendBlocks(conv.id, reply.id, [{ type: 'notice', tone: 'warning', text: tr(lang, rate ? 'e.aiRate' : 'e.aiDown') + (rate && err.retryAfter ? ` (~${err.retryAfter}s)` : '') }]);
        // Drop the incomplete model/tool exchange so the next request starts from a valid history.
        useChat.getState().update(conv.id, (c) => {
          const i = c.wire.lastIndexOf(userWire);
          return { ...c, wire: i >= 0 ? c.wire.slice(0, i + 1) : c.wire };
        });
        useChat.getState().update(conv.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === reply.id ? { ...m, engine: 'local' } : m)) }));
        if (shown === 0) suggestions = await localTurn(conv.id, reply.id, clean, ctx);
        else useChat.getState().update(conv.id, (c) => ({ ...c, wire: [...c.wire, { role: 'model', parts: [{ text: '[Answer interrupted by a service error]' }] }] }));
      }
    } else {
      suggestions = await localTurn(conv.id, reply.id, clean, ctx);
    }
  } catch (e) {
    useChat.getState().appendBlocks(conv.id, reply.id, [{ type: 'notice', tone: 'error', text: tr(lang, 'e.generic', { v: e instanceof Error ? e.message : String(e) }) }]);
  } finally {
    const st = useChat.getState();
    const msg = st.conversations.find((c) => c.id === conv.id)?.messages.find((m) => m.id === reply.id);
    if (msg && msg.blocks.length === 0) st.appendBlocks(conv.id, reply.id, [{ type: 'notice', tone: 'warning', text: tr(lang, 'e.aiDown') }]);
    if (suggestions?.length) st.update(conv.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === reply.id ? { ...m, suggestions: suggestions!.slice(0, 3) } : m)) }));
    st.setBusy(false);
  }
}
