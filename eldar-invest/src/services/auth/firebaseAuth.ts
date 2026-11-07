/**
 * Firebase Authentication backend (email + password).
 * Enabled when VITE_FIREBASE_* variables are configured.
 */
import { getFirebaseApp } from '../firebase';
import { AuthError, validatePassword, type AuthService, type AuthUser, type SignInInput, type SignUpInput } from './types';

type FbUser = import('firebase/auth').User;

async function sdk() {
  const [app, auth] = await Promise.all([getFirebaseApp(), import('firebase/auth')]);
  return { auth: auth.getAuth(app), m: auth };
}

function toUser(u: FbUser): AuthUser {
  return { uid: u.uid, email: u.email ?? '', name: u.displayName ?? (u.email ?? '').split('@')[0] };
}

function mapError(e: unknown): AuthError {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return new AuthError('email-in-use', 'An account with this email already exists.');
    case 'auth/invalid-email':
      return new AuthError('invalid-email', 'Enter a valid email address.');
    case 'auth/weak-password':
      return new AuthError('weak-password', 'Choose a stronger password.');
    case 'auth/too-many-requests':
      return new AuthError('too-many-attempts', 'Too many attempts. Please wait and try again.');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new AuthError('invalid-credentials', 'Incorrect email or password.');
    case 'auth/network-request-failed':
      return new AuthError('unavailable', 'Network error. Check your connection and try again.');
    default:
      return new AuthError('unknown', 'Something went wrong. Please try again.');
  }
}

export class FirebaseAuthService implements AuthService {
  async currentUser(): Promise<AuthUser | null> {
    const { auth } = await sdk();
    await auth.authStateReady();
    return auth.currentUser ? toUser(auth.currentUser) : null;
  }

  async signUp({ name, email, password }: SignUpInput): Promise<AuthUser> {
    const err = validatePassword(password);
    if (err) throw new AuthError('weak-password', err);
    const { auth, m } = await sdk();
    try {
      await m.setPersistence(auth, m.browserLocalPersistence);
      const cred = await m.createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await m.updateProfile(cred.user, { displayName: name.trim() });
      return toUser(cred.user);
    } catch (e) {
      throw mapError(e);
    }
  }

  async signIn({ email, password, remember = true }: SignInInput): Promise<AuthUser> {
    const { auth, m } = await sdk();
    try {
      await m.setPersistence(auth, remember ? m.browserLocalPersistence : m.browserSessionPersistence);
      const cred = await m.signInWithEmailAndPassword(auth, email.trim(), password);
      return toUser(cred.user);
    } catch (e) {
      throw mapError(e);
    }
  }

  async signOut(): Promise<void> {
    const { auth, m } = await sdk();
    await m.signOut(auth);
  }

  async updateProfile(patch: { name?: string }): Promise<AuthUser> {
    const { auth, m } = await sdk();
    if (!auth.currentUser) throw new AuthError('invalid-credentials', 'Please sign in again.');
    if (patch.name) await m.updateProfile(auth.currentUser, { displayName: patch.name.trim() });
    return toUser(auth.currentUser);
  }

  private async reauth(password: string) {
    const { auth, m } = await sdk();
    const u = auth.currentUser;
    if (!u?.email) throw new AuthError('invalid-credentials', 'Please sign in again.');
    try {
      await m.reauthenticateWithCredential(u, m.EmailAuthProvider.credential(u.email, password));
    } catch (e) {
      throw mapError(e);
    }
    return { u, m };
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const err = validatePassword(newPassword);
    if (err) throw new AuthError('weak-password', err);
    const { u, m } = await this.reauth(currentPassword);
    try {
      await m.updatePassword(u, newPassword);
    } catch (e) {
      throw mapError(e);
    }
  }

  async deleteAccount(password: string, beforeDelete?: () => Promise<void>): Promise<void> {
    const { u, m } = await this.reauth(password);
    await beforeDelete?.();
    try {
      await m.deleteUser(u);
    } catch (e) {
      throw mapError(e);
    }
  }
}
