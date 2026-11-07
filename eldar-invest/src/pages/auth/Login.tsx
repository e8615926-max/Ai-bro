import { useState } from 'react';
import { SafeForm } from '@/components/ui/SafeForm';
import { Link } from 'react-router-dom';
import { AlertCircle, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthError, validateEmail } from '@/services/auth/types';
import { useSession } from '@/stores/session';
import { backendName } from '@/services';

export default function Login() {
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; form?: string | null }>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (busy) return;
    const next = { email: validateEmail(email), password: password ? null : 'Password is required.' };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    try {
      await signIn({ email, password, remember });
    } catch (err) {
      setErrors({ form: err instanceof AuthError ? err.message : 'Sign in failed. Please try again.' });
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-[15px] text-ink-2">Sign in to your ELDAR INVEST account.</p>
      <SafeForm className="mt-8 space-y-4" onSubmit={onSubmit}>
        {errors.form && (
          <div className="flex items-start gap-2 rounded-xl bg-loss-soft px-3.5 py-3 text-[13.5px] text-loss" role="alert">
            <AlertCircle size={17} className="mt-px shrink-0" /> {errors.form}
          </div>
        )}
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" leading={<Mail size={18} />} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoFocus />
        <Input label="Password" type="password" autoComplete="current-password" placeholder="Your password" leading={<Lock size={18} />} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-ink-2">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded accent-[rgb(var(--brand))]" />
          Keep me signed in on this device
        </label>
        <Button block size="lg" loading={busy} className="!mt-6" onClick={onSubmit}>
          Sign in
        </Button>
      </SafeForm>
      <p className="mt-6 text-center text-[14px] text-ink-2">
        New to ELDAR INVEST?{' '}
        <Link to="/register" className="font-semibold text-brand hover:text-brand-strong">
          Create a free account
        </Link>
      </p>
      {backendName === 'local' && (
        <p className="mt-8 rounded-xl bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-ink-3">
          Demo mode: accounts are stored securely in this browser only (passwords are salted and hashed). Connect Firebase to enable cloud accounts.
        </p>
      )}
    </div>
  );
}
