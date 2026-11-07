export function uid(prefix = ''): string {
  const bytes = new Uint8Array(10);
  (globalThis.crypto ?? ({} as Crypto)).getRandomValues?.(bytes);
  let s = '';
  for (const b of bytes) s += (b % 36).toString(36);
  if (!s.trim()) s = Math.random().toString(36).slice(2, 12);
  return prefix + Date.now().toString(36) + s;
}
