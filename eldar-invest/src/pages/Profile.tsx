import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, KeyRound, Mail, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Avatar, Stat } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { money, shortDate } from '@/lib/format';
import { AuthError, validatePassword } from '@/services/auth/types';
import { useSummary } from '@/hooks';
import { useAccount } from '@/stores/account';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toast';

const HUES = [150, 200, 230, 265, 320, 10, 35, 95];

export default function Profile() {
  const data = useAccount((s) => s.data)!;
  const updateProfile = useAccount((s) => s.updateProfile);
  const reset = useAccount((s) => s.resetPortfolio);
  const updateName = useSession((s) => s.updateName);
  const s = useSummary()!;
  const [name, setName] = useState(data.profile.name);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const trades = data.transactions.filter((t) => t.type !== 'deposit').length;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error('Name is too short');
    setSaving(true);
    try {
      await updateName(name.trim());
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Could not update profile', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" subtitle="Manage your personal details and account security." />

      <Card className="overflow-hidden">
        <div className="h-24 bg-[linear-gradient(120deg,#19c37d,#0a7a4b)] sm:h-28" />
        <div className="px-5 pb-6 sm:px-6">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <Avatar name={data.profile.name} hue={data.profile.avatarHue} size={84} className="ring-4 ring-surface" />
            <div className="min-w-0 flex-1 pb-1">
              <h2 className="truncate text-xl font-semibold tracking-tight">{data.profile.name}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
                <span className="flex items-center gap-1.5">
                  <Mail size={14} /> {data.profile.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} /> Member since {shortDate(data.profile.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Portfolio value" value={money(s.total)} />
            <Stat label="Total return" value={<span className={s.totalReturn >= 0 ? 'text-gain' : 'text-loss'}>{money(s.totalReturn, { sign: true })}</span>} />
            <Stat label="Trades" value={trades} />
            <Stat label="Watchlist" value={`${data.watchlist.length} assets`} />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Personal details" />
          <form className="space-y-4 p-5 sm:p-6" onSubmit={saveName}>
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <Input label="Email" value={data.profile.email} disabled hint="Email is used to sign in and cannot be changed in the demo." />
            <div>
              <span className="label mb-2 block">Avatar colour</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar colour">
                {HUES.map((h) => (
                  <button
                    key={h}
                    type="button"
                    role="radio"
                    aria-checked={data.profile.avatarHue === h}
                    aria-label={`Colour ${h}`}
                    onClick={() => updateProfile({ avatarHue: h })}
                    className={cn('h-9 w-9 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-105', data.profile.avatarHue === h && 'ring-2 ring-brand')}
                    style={{ background: `linear-gradient(135deg, hsl(${h} 62% 52%), hsl(${(h + 40) % 360} 60% 40%))` }}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" loading={saving} disabled={name.trim() === data.profile.name}>
              Save changes
            </Button>
          </form>
        </Card>
        <ChangePassword />
      </div>

      <Card className="border-loss/25">
        <CardHeader title="Danger zone" subtitle="These actions cannot be undone." />
        <div className="divide-y divide-line p-2 sm:p-3">
          <div className="flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[14px] font-semibold">Reset virtual portfolio</div>
              <div className="text-[13px] text-ink-3">Clears all holdings and transactions and sets virtual cash back to $100,000.</div>
            </div>
            <Button variant="outline" icon={<RotateCcw size={16} />} onClick={() => setResetOpen(true)}>
              Reset portfolio
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[14px] font-semibold text-loss">Delete account</div>
              <div className="text-[13px] text-ink-3">Permanently remove your account and all of its data.</div>
            </div>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset portfolio?" description="All holdings and transactions will be removed and your virtual cash will be set back to $100,000. Your watchlist and settings are kept.">
        <div className="grid grid-cols-2 gap-3 p-6 pt-4">
          <Button variant="secondary" size="lg" onClick={() => setResetOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              reset();
              setResetOpen(false);
              toast.success('Portfolio reset', 'You have $100,000 in virtual cash again.');
            }}
          >
            Reset
          </Button>
        </div>
      </Modal>
      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}

function ChangePassword() {
  const change = useSession((s) => s.changePassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = {
      current: current ? null : 'Enter your current password.',
      next: validatePassword(next),
      confirm: next === confirm ? null : 'Passwords do not match.',
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      await change(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Password changed');
    } catch (err) {
      setErrors({ current: err instanceof AuthError ? err.message : 'Could not change password.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Security" subtitle="Change your password" />
      <form className="space-y-4 p-5 sm:p-6" onSubmit={onSubmit} noValidate>
        <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current} />
        <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.next} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        <Button type="submit" variant="secondary" icon={<KeyRound size={16} />} loading={busy}>
          Update password
        </Button>
      </form>
    </Card>
  );
}

function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const del = useSession((s) => s.deleteAccount);
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Delete your account?" description="This permanently deletes your profile, virtual portfolio and history. Enter your password to confirm.">
      <form
        className="space-y-4 p-6 pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await del(pw);
            toast.success('Account deleted');
            navigate('/register', { replace: true });
          } catch (err) {
            setError(err instanceof AuthError ? err.message : 'Could not delete account.');
            setBusy(false);
          }
        }}
      >
        <Input label="Password" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="lg" loading={busy} disabled={!pw}>
            Delete
          </Button>
        </div>
      </form>
    </Modal>
  );
}
