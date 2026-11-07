import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Lock, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { AuthError, passwordStrength, validateEmail, validatePassword } from '@/services/auth/types';
import { useSession } from '@/stores/session';

export default function Register() {
  const signUp = useSession((s) => s.signUp);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sample, setSample] = useState(true);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null | undefined>>({});
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = {
      name: name.trim().length < 2 ? 'Enter your name.' : null,
      email: validateEmail(email),
      password: validatePassword(password),
      agree: agree ? null : 'Please confirm you understand this is a simulation.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    try {
      await signUp({ name, email, password, samplePortfolio: sample });
    } catch (err) {
      const msg = err instanceof AuthError ? err.message : 'Could not create your account. Please try again.';
      setErrors(err instanceof AuthError && err.code === 'email-in-use' ? { email: msg } : { form: msg });
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-[15px] text-ink-2">Start with $100,000 in virtual money. Free, no card needed.</p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
        {errors.form && (
          <div className="flex items-start gap-2 rounded-xl bg-loss-soft px-3.5 py-3 text-[13.5px] text-loss" role="alert">
            <AlertCircle size={17} className="mt-px shrink-0" /> {errors.form}
          </div>
        )}
        <Input label="Full name" autoComplete="name" placeholder="Alex Morgan" leading={<User size={18} />} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" leading={<Mail size={18} />} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          leading={<Lock size={18} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={
            password ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors',
                        i < strength.score ? (strength.score <= 1 ? 'bg-loss' : strength.score === 2 ? 'bg-warn' : 'bg-gain') : 'bg-surface-3',
                      )}
                    />
                  ))}
                </div>
                <span className="w-16 text-right text-[12px]">{strength.label}</span>
              </div>
            ) : (
              'Use 8+ characters with letters and numbers.'
            )
          }
        />
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition-colors hover:bg-surface-2">
          <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
          <span>
            <span className="block text-[14px] font-medium">Start with a sample portfolio</span>
            <span className="mt-0.5 block text-[12.5px] text-ink-3">Adds a few example trades (marked “Sample”) so you can explore charts right away. You can reset at any time.</span>
          </span>
        </label>
        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] text-ink-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            I understand ELDAR INVEST uses virtual money and simulated demo prices only.
          </label>
          {errors.agree && <p className="ml-6 mt-1 text-[13px] text-loss">{errors.agree}</p>}
        </div>
        <Button type="submit" block size="lg" loading={busy} className="!mt-6">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-[14px] text-ink-2">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand hover:text-brand-strong">
          Sign in
        </Link>
      </p>
    </div>
  );
}
