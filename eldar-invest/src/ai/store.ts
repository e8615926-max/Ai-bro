/** Conversation history for ELDAR AI, persisted per user in this browser. */
import { create } from 'zustand';
import type { AiLang } from '@shared/aiTools';
import { uid } from '@/domain/ids';
import { readJSON, readRaw, writeJSON, writeRaw } from '@/services/storage';
import type { Block, ChatMessage, Conversation } from './types';

const MAX_CONVERSATIONS = 25;
const MAX_WIRE = 40;

function defaultLang(): AiLang {
  const saved = readRaw('ai-lang');
  if (saved === 'ru' || saved === 'en') return saved;
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

interface ChatState {
  uid: string | null;
  lang: AiLang;
  conversations: Conversation[];
  activeId: string | null;
  busy: boolean;
  load: (uid: string) => void;
  setLang: (lang: AiLang) => void;
  setBusy: (busy: boolean) => void;
  newChat: () => void;
  open: (id: string) => void;
  remove: (id: string) => void;
  ensure: () => Conversation;
  update: (id: string, fn: (c: Conversation) => Conversation) => void;
  addMessage: (id: string, m: ChatMessage) => void;
  appendBlocks: (id: string, messageId: string, blocks: Block[]) => void;
  patchBlock: (id: string, match: (b: Block) => boolean, fn: (b: Block) => Block) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useChat = create<ChatState>((set, get) => {
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const { uid: u, conversations } = get();
      if (!u) return;
      try {
        writeJSON(`ai:${u}`, conversations.filter((c) => c.messages.length).slice(0, MAX_CONVERSATIONS));
      } catch {
        // Storage full: keep only the newest conversations.
        try {
          writeJSON(`ai:${u}`, conversations.filter((c) => c.messages.length).slice(0, 5));
        } catch {
          /* history stays in memory for this session */
        }
      }
    }, 300);
  };

  return {
    uid: null,
    lang: defaultLang(),
    conversations: [],
    activeId: null,
    busy: false,

    load: (u) => {
      if (get().uid === u) return;
      const saved = (readJSON<Conversation[]>(`ai:${u}`) ?? []).map((c) => ({
        ...c,
        // A trade left "executing" by a closed tab was never confirmed to the user: mark it cancelled.
        messages: c.messages.map((m) => ({ ...m, blocks: m.blocks.map((b) => (b.type === 'trade' && b.proposal.status === 'executing' ? { ...b, proposal: { ...b.proposal, status: 'cancelled' as const } } : b)) })),
      }));
      set({ uid: u, conversations: saved, activeId: null, busy: false });
    },

    setLang: (lang) => {
      writeRaw('ai-lang', lang);
      set({ lang });
    },
    setBusy: (busy) => set({ busy }),
    newChat: () => set({ activeId: null }),
    open: (id) => set({ activeId: id }),
    remove: (id) => {
      set({ conversations: get().conversations.filter((c) => c.id !== id), activeId: get().activeId === id ? null : get().activeId });
      persist();
    },

    ensure: () => {
      const { activeId, conversations, lang } = get();
      const existing = conversations.find((c) => c.id === activeId);
      if (existing) return existing;
      const now = Date.now();
      const c: Conversation = { id: uid('cv_'), title: '', createdAt: now, updatedAt: now, messages: [], wire: [], focus: [], lang };
      set({ conversations: [c, ...conversations], activeId: c.id });
      return c;
    },

    update: (id, fn) => {
      set({
        conversations: get()
          .conversations.map((c) => {
            if (c.id !== id) return c;
            const next = fn(c);
            return { ...next, wire: trimWire(next.wire), updatedAt: Date.now() };
          })
          .sort((a, b) => b.updatedAt - a.updatedAt),
      });
      persist();
    },

    addMessage: (id, m) =>
      get().update(id, (c) => ({ ...c, title: c.title || titleFrom(m), messages: [...c.messages, m] })),

    appendBlocks: (id, messageId, blocks) =>
      get().update(id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, blocks: [...m.blocks, ...blocks] } : m)) })),

    patchBlock: (id, match, fn) =>
      get().update(id, (c) => ({ ...c, messages: c.messages.map((m) => ({ ...m, blocks: m.blocks.map((b) => (match(b) ? fn(b) : b)) })) })),
  };
});

function titleFrom(m: ChatMessage): string {
  const b = m.blocks.find((x) => x.type === 'text');
  const text = b && b.type === 'text' ? b.text : '';
  return text.length > 48 ? text.slice(0, 46).trimEnd() + '…' : text;
}

/** Keeps the model context bounded; the cut always lands on a plain user message. */
export function trimWire<T extends { role: string; parts: Record<string, unknown>[] }>(wire: T[]): T[] {
  if (wire.length <= MAX_WIRE) return wire;
  let start = wire.length - MAX_WIRE;
  while (start < wire.length && !(wire[start].role === 'user' && wire[start].parts.some((p) => typeof p.text === 'string'))) start++;
  return start < wire.length ? wire.slice(start) : wire.slice(-2);
}
