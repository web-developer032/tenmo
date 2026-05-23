import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { TenantSidebar } from '@/components/app-shell/tenant-sidebar';
import { loadSidebarBadgeCounts } from '@/features/app-shell/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Layout for /tenant/* — any authenticated user may visit this (it's a personal
 * dashboard scoped to their tenancies). RLS ensures only their own tenancies
 * are visible. If they have no tenancies, the inner page renders an empty state.
 */
export default async function TenantLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant');

  const [profileResp, badgeCounts, pendingApplications] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    loadSidebarBadgeCounts(supabase, { userId: user.id }),
    supabase
      .from('room_applications')
      .select('id', { count: 'exact', head: true })
      .eq('applicant_user_id', user.id)
      .eq('status', 'pending'),
  ]);

  const fullName = profileResp.data?.full_name ?? user.email ?? 'Tenant';
  const initials =
    fullName
      .split(/\s+/)
      .map((p: string) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'T';

  return (
    <AppShell
      sidebar={
        <TenantSidebar
          unreadMessages={badgeCounts.unreadMessages}
          unreadNotifications={badgeCounts.unreadNotifications}
          openTickets={badgeCounts.openTickets}
          pendingApplications={pendingApplications.count ?? 0}
          userInitials={initials}
          userName={fullName}
          userSub={user.email ?? undefined}
        />
      }
      pageTitle="My home"
      pageSubtitle="Tenant Portal"
    >
      <div className="min-w-0 p-4 lg:p-7">{children}</div>
    </AppShell>
  );
}
