import 'server-only';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { NOTIFICATION_BELL_LIMIT } from '@/core/constants/notifications';
import { readImpersonationContext } from '@/features/admin/impersonation';
import { InboxIcon } from '@/features/messaging/components/inbox-icon';
import { loadUnreadMessagesCount } from '@/features/messaging/loaders';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { loadNotificationFeed } from '@/features/notifications/loaders';
import { loadRoleAvailability } from '@/features/role-switcher/loader';
import { RoleSwitcher } from '@/features/role-switcher/role-switcher';
import { createClient } from '@/lib/supabase/server';
import { ImpersonationBanner } from './impersonation-banner';
import { MobileDrawer, MobileDrawerProvider } from './mobile-drawer';
import { Topbar, TopbarActions, TopbarSearch, TopbarTitle } from './topbar';
import { UserMenu } from './user-menu';

/*
 * Authenticated app shell — Tenantly / HMOeez responsive frame.
 *
 *   lg+:  fixed 220px sidebar on the left + sticky 60px topbar + content
 *         column padded with `p-4 lg:p-7`.
 *   <lg:  sidebar is rendered inside a left-side drawer triggered by the
 *         hamburger button in the topbar. Drawer auto-closes on route
 *         change (handled in `mobile-drawer.tsx`).
 *
 * Every authenticated route (landlord, tenant, admin) passes the relevant
 * `<Sidebar />` instance as the `sidebar` prop; the shell renders it twice
 * — once inline for `lg+` and once inside the drawer for `<lg`. Rendering
 * the same React tree in two slots keeps the API simple at the cost of a
 * tiny duplication; the alternative (single mount with portal) introduces
 * SSR/hydration churn.
 */
export type AppShellProps = {
  children: ReactNode;
  sidebar?: ReactNode;
  pageTitle?: ReactNode;
  pageSubtitle?: ReactNode;
};

export async function AppShell({ children, sidebar, pageTitle, pageSubtitle }: AppShellProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [availability, profileResp, notifications, unreadMessages, impersonation] =
    await Promise.all([
      loadRoleAvailability(),
      supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
      loadNotificationFeed(NOTIFICATION_BELL_LIMIT),
      loadUnreadMessagesCount(),
      readImpersonationContext(),
    ]);

  const topbarRight = (
    <>
      <RoleSwitcher availability={availability} />
      <TopbarSearch />
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
    </>
  );

  return (
    <MobileDrawerProvider>
      <div className="flex min-h-dvh bg-bg-page text-ink">
        {sidebar ? (
          <aside
            className="sticky top-0 hidden h-dvh w-(--layout-sidebar-w) shrink-0 lg:block"
            aria-label="Primary navigation"
          >
            {sidebar}
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {impersonation ? (
            <ImpersonationBanner
              targetName={impersonation.name}
              targetEmail={impersonation.email}
            />
          ) : null}
          <Topbar>
            <TopbarTitle title={pageTitle ?? 'Tenantly'} subtitle={pageSubtitle} />
            <TopbarActions>{topbarRight}</TopbarActions>
          </Topbar>
          <main className="flex-1">{children}</main>
        </div>
      </div>

      {sidebar ? <MobileDrawer>{sidebar}</MobileDrawer> : null}
    </MobileDrawerProvider>
  );
}
