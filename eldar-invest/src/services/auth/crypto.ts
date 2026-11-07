/** Password hashing for the local backend (PBKDF2-SHA-256 via Web Crypto). */
const ITERATIONS = 150_000;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Secure context required: open ELDAR INVEST over HTTPS or localhost.');
  return s;
}

export interface PasswordHash {
  salt: string;
  hash: string;
  iterations: number;
}

export async function hashPassword(password: string, saltHex?: string, iterations = ITERATIONS): Promise<PasswordHash> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await subtle().importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return { salt: toHex(salt), hash: toHex(bits), iterations };
}

/** Constant-time comparison of two hex strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const { hash } = await hashPassword(password, stored.salt, stored.iterations);
  return safeEqual(hash, stored.hash);
}

export function randomToken(bytes = 24): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}
