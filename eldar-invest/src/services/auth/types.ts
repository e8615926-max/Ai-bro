export interface AuthUser {
  uid: string;
  email: string;
  name: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
  remember?: boolean;
}

export type AuthErrorCode =
  | 'email-in-use'
  | 'invalid-credentials'
  | 'weak-password'
  | 'invalid-email'
  | 'too-many-attempts'
  | 'unavailable'
  | 'unknown';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Contract implemented by every authentication backend. */
export interface AuthService {
  /** Restores the persisted session, if any. */
  currentUser(): Promise<AuthUser | null>;
  signUp(input: SignUpInput): Promise<AuthUser>;
  signIn(input: SignInInput): Promise<AuthUser>;
  signOut(): Promise<void>;
  updateProfile(patch: { name?: string }): Promise<AuthUser>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /** Re-verifies the password, runs `beforeDelete` (e.g. data cleanup), then deletes the account. */
  deleteAccount(password: string, beforeDelete?: () => Promise<void>): Promise<void>;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return 'Enter a valid email address.';
  return null;
}

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  else if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 0.5;
  const s = Math.min(4, Math.floor(score)) as 0 | 1 | 2 | 3 | 4;
  return { score: s, label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][s] };
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Include at least one letter and one number.';
  return null;
}
