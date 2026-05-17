import 'server-only';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { NOTIFICATION_BELL_LIMIT } from '@/core/constants/notifications';
import { InboxIcon } from '@/features/messaging/components/inbox-icon';
import { loadUnreadMessagesCount } from '@/features/messaging/loaders';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { loadNotificationFeed } from '@/features/notifications/loaders';
import { loadRoleAvailability } from '@/features/role-switcher/loader';
import { RoleSwitcher } from '@/features/role-switcher/role-switcher';
import { createClient } from '@/lib/supabase/server';
import { UserMenu } from './user-menu';

/**
 * Authenticated app shell — header with brand, role switcher and user menu.
 *
 * Used as the root layout for `/landlord/[slug]`, `/tenant/...` and `/admin/...`.
 * If the user is not signed in, we redirect to /login. Membership/role checks
 * for specific contexts happen in their respective layouts.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [availability, profileResp, notifications, unreadMessages] = await Promise.all([
    loadRoleAvailability(),
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
    loadNotificationFeed(NOTIFICATION_BELL_LIMIT),
    loadUnreadMessagesCount(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center gap-4 px-4">
          <Link href="/dispatch" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-6 w-6 rounded-md bg-primary" aria-hidden="true" />
            <span>Tenantly</span>
          </Link>

          <span className="hidden text-muted-foreground md:inline">/</span>

          <RoleSwitcher availability={availability} />

          <div className="ml-auto flex items-center gap-1">
            <InboxIcon userId={user.id} initialUnreadTotal={unreadMessages} />
            <NotificationBell
              userId={user.id}
              initial={{
                notifications: notifications.notifications,
                unread: { total: notifications.unreadCount },
              }}
            />
            <UserMenu
              email={user.email ?? ''}
              fullName={profileResp.data?.full_name ?? null}
              avatarUrl={profileResp.data?.avatar_url ?? null}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
