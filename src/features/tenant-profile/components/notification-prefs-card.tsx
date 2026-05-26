'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { NotificationGroup, NotificationKind } from '@/core/constants/notifications';
import type { NotificationPreferences } from '@/core/schemas/notification';
import { updateNotificationPreferencesApi } from '@/features/notifications/api/client';

/**
 * Profile-page "Notification preferences" card.
 *
 * The full preferences UI lives at `/account/settings/notifications`. This
 * card surfaces the four high-traffic toggles from the design (Rent
 * reminders, Maintenance updates, Landlord messages, Inspection notices)
 * and writes back through the same `/api/notifications/preferences`
 * endpoint. Each toggle flips the relevant kind's `in_app` channel; the
 * detailed kind-by-kind controls remain on the settings page reachable
 * via "Manage all preferences →".
 *
 * If a user wants email-only or per-kind tuning they go to the settings
 * page — this card intentionally stays simple to match the visual mock.
 */

type ToggleRow = {
  kind: NotificationKind;
  group: NotificationGroup;
  title: string;
  description: string;
};

const ROWS: ToggleRow[] = [
  {
    kind: 'rent_charged',
    group: 'rent',
    title: 'Rent reminders',
    description: 'Before due date',
  },
  {
    kind: 'ticket_status_changed',
    group: 'tickets',
    title: 'Maintenance updates',
    description: 'When status changes',
  },
  {
    kind: 'message_received',
    group: 'messages',
    title: 'Landlord messages',
    description: 'Push + email notifications',
  },
  {
    kind: 'compliance_due',
    group: 'compliance',
    title: 'Inspection notices',
    description: 'When inspection is scheduled',
  },
];

function readChannel(prefs: NotificationPreferences, kind: NotificationKind): boolean {
  return prefs.categories?.[kind]?.in_app ?? prefs.channels?.in_app ?? true;
}

export function NotificationPrefsCard({ initial }: { initial: NotificationPreferences }) {
  const [prefs, setPrefs] = React.useState<NotificationPreferences>(initial);
  const [busyKind, setBusyKind] = React.useState<NotificationKind | null>(null);

  const onToggle = async (kind: NotificationKind, next: boolean) => {
    setBusyKind(kind);
    const previous = prefs;
    const optimistic: NotificationPreferences = {
      ...prefs,
      categories: {
        ...prefs.categories,
        [kind]: {
          ...(prefs.categories?.[kind] ?? {}),
          in_app: next,
        },
      },
    };
    setPrefs(optimistic);
    try {
      const updated = await updateNotificationPreferencesApi({
        categories: {
          [kind]: {
            in_app: next,
          },
        },
      });
      setPrefs(updated);
    } catch (err) {
      setPrefs(previous);
      toast.error(err instanceof Error ? err.message : 'Could not update preference');
    } finally {
      setBusyKind(null);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {ROWS.map((row) => {
        const checked = readChannel(prefs, row.kind);
        return (
          <div key={row.kind} className="flex items-center justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <div className="font-sans text-[13px] font-bold tracking-tight text-ink">
                {row.title}
              </div>
              <div className="text-[11px] text-ink-light">{row.description}</div>
            </div>
            <Switch
              checked={checked}
              disabled={busyKind === row.kind}
              onCheckedChange={(value) => onToggle(row.kind, Boolean(value))}
              label={row.title}
            />
          </div>
        );
      })}
      <div className="mt-2">
        <Button asChild variant="ghost" size="sm" className="px-0 text-forest-700">
          <Link href="/account/settings/notifications">
            <ExternalLink className="h-3.5 w-3.5" />
            Manage all preferences
          </Link>
        </Button>
      </div>
    </div>
  );
}
