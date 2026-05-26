import { cn } from '@/lib/cn';
import type { NoticeRow } from '../types';

/**
 * "Notices from landlord" card on the tenant Home.
 *
 * Notices are sourced from `public.notifications` rows with the relevant
 * `kind` (`compliance_due`, `compliance_overdue`, `system`) — see
 * `loadTenantDashboard`. Each row has a coloured leader dot to communicate
 * urgency at a glance.
 */

const DOT_TONE: Record<NoticeRow['dotTone'], string> = {
  forest: 'bg-forest-600',
  amber: 'bg-amber',
  alert: 'bg-alert',
};

export function NoticesList({ notices }: { notices: NoticeRow[] }) {
  if (notices.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-light">
        Nothing from your landlord right now. We&apos;ll surface inspection notices, announcements
        and compliance reminders here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border-soft">
      {notices.map((n) => (
        <li key={n.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <span
            className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', DOT_TONE[n.dotTone])}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink">{n.title}</div>
            {n.body ? <div className="mt-0.5 text-[11.5px] text-ink-light">{n.body}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
