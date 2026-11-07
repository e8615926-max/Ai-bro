import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BellOff, CheckCheck, CheckCircle2, Info, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import { useAccount } from '@/stores/account';

export default function Notifications() {
  const items = useAccount((s) => s.data!.notifications);
  const markAllRead = useAccount((s) => s.markAllRead);
  const markRead = useAccount((s) => s.markRead);
  const clear = useAccount((s) => s.clearNotifications);
  const navigate = useNavigate();
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You are all caught up'}
        action={
          items.length > 0 && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={<CheckCheck size={16} />} onClick={markAllRead} disabled={!unread}>
                Mark all read
              </Button>
              <Button variant="ghost" size="sm" icon={<Trash2 size={16} />} onClick={clear}>
                Clear
              </Button>
            </div>
          )
        }
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState icon={<BellOff />} title="No notifications" body="Order confirmations, price alerts and daily summaries will appear here." action={<ButtonLink to="/settings" variant="secondary" size="sm">Notification settings</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const Icon = n.tone === 'success' ? CheckCircle2 : n.tone === 'warning' ? AlertTriangle : Info;
              return (
                <li key={n.id}>
                  <button
                    className={cn('flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-surface-2', !n.read && 'bg-brand-soft/40')}
                    onClick={() => {
                      markRead(n.id);
                      if (n.href) navigate(n.href);
                    }}
                  >
                    <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', n.tone === 'success' ? 'bg-gain-soft text-gain' : n.tone === 'warning' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-2')}>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold">{n.title}</span>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-brand" aria-label="unread" />}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-2">{n.body}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-3">{relativeTime(n.at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
