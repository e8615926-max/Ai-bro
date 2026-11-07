/**
 * Local authentication backend.
 *
 * Accounts live in this browser only. Passwords are never stored in plain
 * text: each one is hashed with PBKDF2-SHA-256 (150k iterations) and a random
 * per-user salt. Sessions are random tokens that expire. This is suitable for
 * an offline demo; for production use the Firebase backend, which performs
 * authentication on the server.
 */
import { uid } from '@/domain/ids';
import { readJSON, removeKey, writeJSON } from '../storage';
import { hashPassword, randomToken, verifyPassword, type PasswordHash } from './crypto';
import {
  AuthError,
  validateEmail,
  validatePassword,
  type AuthService,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
} from './types';

interface StoredUser extends PasswordHash {
  uid: string;
  email: string;
  name: string;
  createdAt: number;
}

interface Session {
  token: string;
  uid: string;
  expiresAt: number;
}

interface Throttle {
  count: number;
  until: number;
}

const USERS_KEY = 'auth:users';
const SESSION_KEY = 'auth:session';
const THROTTLE_KEY = 'auth:throttle';
const REMEMBER_MS = 30 * 24 * 3600_000;
const SHORT_MS = 12 * 3600_000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (email: string) => email.trim().toLowerCase();

function users(): Record<string, StoredUser> {
  return readJSON<Record<string, StoredUser>>(USERS_KEY) ?? {};
}

function toAuthUser(u: StoredUser): AuthUser {
  return { uid: u.uid, email: u.email, name: u.name };
}

function readSession(): Session | null {
  return readJSON<Session>(SESSION_KEY) ?? readJSON<Session>(SESSION_KEY, 'session');
}

function startSession(user: StoredUser, remember: boolean) {
  const session: Session = { token: randomToken(), uid: user.uid, expiresAt: Date.now() + (remember ? REMEMBER_MS : SHORT_MS) };
  removeKey(SESSION_KEY);
  removeKey(SESSION_KEY, 'session');
  writeJSON(SESSION_KEY, session, remember ? 'local' : 'session');
}

function sessionUser(): StoredUser | null {
  const s = readSession();
  if (!s || s.expiresAt < Date.now()) return null;
  return Object.values(users()).find((u) => u.uid === s.uid) ?? null;
}

export class LocalAuthService implements AuthService {
  async currentUser(): Promise<AuthUser | null> {
    await delay(150);
    const u = sessionUser();
    if (!u) {
      removeKey(SESSION_KEY);
      removeKey(SESSION_KEY, 'session');
    }
    return u ? toAuthUser(u) : null;
  }

  async signUp({ name, email, password }: SignUpInput): Promise<AuthUser> {
    const emailErr = validateEmail(email);
    if (emailErr) throw new AuthError('invalid-email', emailErr);
    const pwErr = validatePassword(password);
    if (pwErr) throw new AuthError('weak-password', pwErr);
    const all = users();
    const key = norm(email);
    if (all[key]) throw new AuthError('email-in-use', 'An account with this email already exists.');
    const hash = await hashPassword(password);
    const user: StoredUser = { uid: uid('u_'), email: key, name: name.trim() || key.split('@')[0], createdAt: Date.now(), ...hash };
    writeJSON(USERS_KEY, { ...all, [key]: user });
    startSession(user, true);
    return toAuthUser(user);
  }

  async signIn({ email, password, remember = true }: SignInInput): Promise<AuthUser> {
    const key = norm(email);
    const throttle = readJSON<Record<string, Throttle>>(THROTTLE_KEY) ?? {};
    const t = throttle[key];
    if (t && t.until > Date.now()) {
      throw new AuthError('too-many-attempts', `Too many attempts. Try again in ${Math.ceil((t.until - Date.now()) / 1000)} seconds.`);
    }
    const user = users()[key];
    // Hash even when the user doesn't exist so timing doesn't reveal accounts.
    const ok = user ? await verifyPassword(password, user) : (await hashPassword(password), false);
    if (!ok || !user) {
      const count = (t?.count ?? 0) + 1;
      throttle[key] = { count: count >= MAX_ATTEMPTS ? 0 : count, until: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 };
      writeJSON(THROTTLE_KEY, throttle);
      throw new AuthError('invalid-credentials', 'Incorrect email or password.');
    }
    delete throttle[key];
    writeJSON(THROTTLE_KEY, throttle);
    startSession(user, remember);
    return toAuthUser(user);
  }

  async signOut(): Promise<void> {
    await delay(120);
    removeKey(SESSION_KEY);
    removeKey(SESSION_KEY, 'session');
  }

  async updateProfile(patch: { name?: string }): Promise<AuthUser> {
    const u = sessionUser();
    if (!u) throw new AuthError('invalid-credentials', 'Your session has expired. Please sign in again.');
    const all = users();
    const next = { ...u, name: patch.name?.trim() || u.name };
    all[u.email] = next;
    writeJSON(USERS_KEY, all);
    return toAuthUser(next);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const u = sessionUser();
    if (!u) throw new AuthError('invalid-credentials', 'Your session has expired. Please sign in again.');
    if (!(await verifyPassword(currentPassword, u))) throw new AuthError('invalid-credentials', 'Current password is incorrect.');
    const err = validatePassword(newPassword);
    if (err) throw new AuthError('weak-password', err);
    const all = users();
    all[u.email] = { ...u, ...(await hashPassword(newPassword)) };
    writeJSON(USERS_KEY, all);
  }

  async deleteAccount(password: string, beforeDelete?: () => Promise<void>): Promise<void> {
    const u = sessionUser();
    if (!u) throw new AuthError('invalid-credentials', 'Your session has expired. Please sign in again.');
    if (!(await verifyPassword(password, u))) throw new AuthError('invalid-credentials', 'Password is incorrect.');
    await beforeDelete?.();
    const all = users();
    delete all[u.email];
    writeJSON(USERS_KEY, all);
    await this.signOut();
  }
}
