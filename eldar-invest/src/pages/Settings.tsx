import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Database, Download, Eye, LineChart, Monitor, Moon, Palette, ShieldCheck, Sun } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import type { ThemePreference, UserSettings } from '@/domain/types';
import { cn } from '@/lib/cn';
import { downloadFile } from '@/lib/download';
import { DEMO_DATA_NOTICE, RANGES } from '@/lib/market';
import { backendName } from '@/services';
import { useAccount } from '@/stores/account';
import { toast } from '@/stores/toast';

function Section({ icon: Icon, title, subtitle, children }: { icon: typeof Bell; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="text-[13px] text-ink-3">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}

function Row({ title, body, control }: { title: string; body?: ReactNode; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{title}</div>
        {body && <div className="mt-0.5 text-[13px] text-ink-3">{body}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function Settings() {
  const data = useAccount((s) => s.data)!;
  const update = useAccount((s) => s.updateSettings);
  const updateNotif = useAccount((s) => s.updateNotificationPrefs);
  const saveStatus = useAccount((s) => s.saveStatus);
  const st = data.settings;
  const n = st.notifications;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Preferences are saved automatically."
        action={
          <span className={cn('flex items-center gap-1.5 text-[12.5px] font-medium', saveStatus === 'error' ? 'text-loss' : 'text-ink-3')} aria-live="polite">
            <span className={cn('h-2 w-2 rounded-full', saveStatus === 'saving' ? 'animate-pulse bg-warn' : saveStatus === 'error' ? 'bg-loss' : 'bg-gain')} />
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved' : 'All changes saved'}
          </span>
        }
      />

      <Section icon={Palette} title="Appearance" subtitle="Choose how ELDAR INVEST looks on this device and account.">
        <div className="px-5 py-5 sm:px-6">
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.value}
                role="radio"
                aria-checked={st.theme === t.value}
                onClick={() => update({ theme: t.value }, `Theme set to ${t.label.toLowerCase()}`)}
                className={cn(
                  'group flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all sm:p-4',
                  st.theme === t.value ? 'border-brand bg-brand-soft/50 shadow-[0_0_0_3px_rgb(var(--brand)/0.12)]' : 'border-line hover:bg-surface-2',
                )}
              >
                <ThemePreview kind={t.value} />
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <t.icon size={14} /> {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section icon={LineChart} title="Display" subtitle="Charts and privacy on screen.">
        <Row title="Hide balances" body="Mask money amounts — useful in public places." control={<Switch label="Hide balances" checked={st.hideBalances} onChange={(v) => update({ hideBalances: v }, v ? 'Balances hidden' : 'Balances shown')} />} />
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="text-[14px] font-medium">Default portfolio chart range</div>
            <div className="mt-0.5 text-[13px] text-ink-3">Used on Home and Portfolio.</div>
          </div>
          <Segmented size="sm" label="Default range" value={st.defaultRange} onChange={(v) => update({ defaultRange: v as UserSettings['defaultRange'] }, `Default chart range set to ${v}`)} options={RANGES.map((r) => ({ value: r, label: r }))} />
        </div>
      </Section>

      <Section icon={Bell} title="Notifications" subtitle="In-app notifications and alerts.">
        <Row title="Order confirmations" body="Get a notification each time a simulated order fills." control={<Switch label="Order confirmations" checked={n.tradeConfirmations} onChange={(v) => updateNotif({ tradeConfirmations: v })} />} />
        <Row title="Price movement alerts" body="Alert me when a watched or owned asset moves sharply in a day." control={<Switch label="Price movement alerts" checked={n.priceAlerts} onChange={(v) => updateNotif({ priceAlerts: v })} />} />
        {n.priceAlerts && (
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="text-[14px] font-medium">Alert threshold</div>
            <Segmented
              size="sm"
              label="Alert threshold"
              value={String(n.priceAlertThreshold)}
              onChange={(v) => updateNotif({ priceAlertThreshold: Number(v) })}
              options={[0.02, 0.03, 0.05, 0.1].map((x) => ({ value: String(x), label: `±${x * 100}%` }))}
            />
          </div>
        )}
        <Row title="Daily summary" body="A once-a-day snapshot of your portfolio when you open the app." control={<Switch label="Daily summary" checked={n.dailySummary} onChange={(v) => updateNotif({ dailySummary: v })} />} />
        <Link to="/notifications" className="flex items-center justify-between px-5 py-4 text-[14px] font-medium hover:bg-surface-2 sm:px-6">
          View all notifications <ChevronRight size={18} className="text-ink-3" />
        </Link>
      </Section>

      <Section icon={Database} title="Data & privacy" subtitle="Your information stays under your control.">
        <Row
          title="Export my data"
          body="Download your profile, portfolio and history as JSON."
          control={
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={15} />}
              onClick={() => {
                downloadFile(`eldar-invest-account-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ notice: DEMO_DATA_NOTICE, ...data }, null, 2), 'application/json');
                toast.success('Export ready');
              }}
            >
              Export
            </Button>
          }
        />
        <Row
          title="Storage backend"
          body={backendName === 'firebase' ? 'Firebase Authentication and Cloud Firestore.' : 'This browser (local demo backend). Passwords are salted and hashed with PBKDF2.'}
          control={<span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-ink-2">{backendName === 'firebase' ? 'Cloud' : 'Local'}</span>}
        />
        <Link to="/activity?tab=activity" className="flex items-center justify-between px-5 py-4 text-[14px] font-medium hover:bg-surface-2 sm:px-6">
          <span className="flex items-center gap-2">
            <Eye size={16} className="text-ink-3" /> Account activity history
          </span>
          <ChevronRight size={18} className="text-ink-3" />
        </Link>
      </Section>

      <Card className="flex items-start gap-3 p-5 sm:p-6">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand" />
        <div className="text-[13px] leading-relaxed text-ink-2">
          <strong className="text-ink">About ELDAR INVEST.</strong> ELDAR INVEST is an educational trading simulator by ELDAR COMPANY. All balances are virtual and all market prices, charts and statistics are simulated demo data — they are not real quotes and nothing here is investment advice. Version 1.0.0.
        </div>
      </Card>
    </div>
  );
}

function ThemePreview({ kind }: { kind: ThemePreference }) {
  const pane = (dark: boolean) => (
    <div className={cn('flex h-full flex-1 flex-col gap-1 p-1.5', dark ? 'bg-[#131816]' : 'bg-white')}>
      <div className={cn('h-1.5 w-8 rounded-full', dark ? 'bg-[#2a3330]' : 'bg-[#e6eae8]')} />
      <svg viewBox="0 0 40 14" className="mt-auto w-full">
        <path d="M0 12 L8 9 L14 10 L22 5 L30 6 L40 1" fill="none" stroke={dark ? '#22c57e' : '#10a365'} strokeWidth="1.6" />
      </svg>
    </div>
  );
  return (
    <div className="flex h-14 w-full overflow-hidden rounded-xl border border-line sm:h-16">
      {kind === 'light' && pane(false)}
      {kind === 'dark' && pane(true)}
      {kind === 'system' && (
        <>
          {pane(false)}
          {pane(true)}
        </>
      )}
    </div>
  );
}
