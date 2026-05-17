import { redirect } from 'next/navigation';
import { NotificationPreferencesForm } from '@/features/notifications/components/notification-preferences-form';
import { loadNotificationPreferences } from '@/features/notifications/loaders';

export const dynamic = 'force-dynamic';

/**
 * `/account/settings/notifications` — per-user preferences.
 *
 * Critical kinds (overdue compliance, failed rent, billing) keep email
 * forced-on per docs/07-flows/12-notifications.md. The form merges any
 * patch on top of the existing prefs via PATCH /api/notifications/preferences.
 */
export default async function NotificationPreferencesPage() {
  const prefs = await loadNotificationPreferences();
  if (!prefs) redirect('/login?redirect=/account/settings/notifications');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Notification preferences
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose how Tenantly reaches you. Critical alerts are always emailed so you never miss
          them.
        </p>
      </header>
      <NotificationPreferencesForm initial={prefs} />
    </div>
  );
}
