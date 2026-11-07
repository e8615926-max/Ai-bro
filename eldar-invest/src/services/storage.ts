/** Safe wrappers around localStorage / sessionStorage (private mode, quota). */
const PREFIX = 'eldar:';

function store(kind: 'local' | 'session'): Storage | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    const k = PREFIX + '__probe';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

const memory = new Map<string, string>();

export function readJSON<T>(key: string, kind: 'local' | 'session' = 'local'): T | null {
  const s = store(kind);
  const raw = s ? s.getItem(PREFIX + key) : memory.get(kind + PREFIX + key) ?? null;
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown, kind: 'local' | 'session' = 'local'): void {
  const raw = JSON.stringify(value);
  const s = store(kind);
  if (!s) {
    memory.set(kind + PREFIX + key, raw);
    return;
  }
  try {
    s.setItem(PREFIX + key, raw);
  } catch (e) {
    console.error(e);
    throw new Error('Could not save data: browser storage is full or unavailable.');
  }
}

export function removeKey(key: string, kind: 'local' | 'session' = 'local'): void {
  const s = store(kind);
  if (s) s.removeItem(PREFIX + key);
  memory.delete(kind + PREFIX + key);
}

export function readRaw(key: string): string | null {
  return store('local')?.getItem(PREFIX + key) ?? null;
}

export function writeRaw(key: string, value: string): void {
  try {
    store('local')?.setItem(PREFIX + key, value);
  } catch {
    /* ignore */
  }
}
