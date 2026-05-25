import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { LandlordSidebar } from '@/components/app-shell/landlord-sidebar';
import { TenantSidebar } from '@/components/app-shell/tenant-sidebar';
import {
  loadSidebarBadgeCounts,
  type RememberedWorkspace,
  readRememberedWorkspace,
} from '@/features/app-shell/server';
import { loadOrgSubscription } from '@/features/billing/loaders';
import { loadRoleAvailability } from '@/features/role-switcher/loader';
import { createClient } from '@/lib/supabase/server';

const TIER_LABELS: Record<string, string> = {
  free: 'Free plan',
  starter: 'Starter plan',
  pro: 'Pro plan',
  portfolio: 'Portfolio plan',
  trial: 'Trial',
};

/**
 * Layout for `/messages` and `/messages/[id]` — accessible to any
 * authenticated user (RLS handles which conversations they can see).
 *
 * Messaging is cross-context: a landlord typing into a thread is still
 * inside their landlord workspace, and a tenant typing in the same
 * thread is inside theirs. We resolve the right sidebar by reading the
 * `tly-workspace` cookie (set by `proxy.ts` when the user last visited
 * a workspace-scoped route) and falling back to the most useful
 * workspace the user actually has (landlord first, then tenant, then
 * admin).
 *
 * Without this restoration the workspace nav disappears the moment a
 * landlord opens their inbox.
 */
export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/messages');

  const [availability, remembered, profileResp] = await Promise.all([
    loadRoleAvailability(),
    readRememberedWorkspace(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);

  const workspace = pickWorkspace(remembered, availability);
  const fullName = profileResp.data?.full_name ?? user.email ?? 'Tenantly user';
  const initials = initialsFrom(fullName);

  const sidebar = await renderSidebarFor({
    supabase,
    userId: user.id,
    workspace,
    availability,
    fullName,
    initials,
    userSub: user.email ?? undefined,
  });

  return (
    <AppShell sidebar={sidebar} pageTitle="Messages" pageSubtitle="Inbox">
      {children}
    </AppShell>
  );
}

function pickWorkspace(
  remembered: RememberedWorkspace | null,
  availability: Awaited<ReturnType<typeof loadRoleAvailability>>,
): RememberedWorkspace | null {
  if (
    remembered?.kind === 'landlord' &&
    availability.orgs.some((o) => o.slug === remembered.slug)
  ) {
    return remembered;
  }
  if (remembered?.kind === 'tenant' && availability.hasTenancies) {
    return remembered;
  }
  if (remembered?.kind === 'admin' && availability.isAdmin) {
    return remembered;
  }
  if (availability.orgs.length > 0) {
    return { kind: 'landlord', slug: availability.orgs[0]!.slug };
  }
  if (availability.hasTenancies) return { kind: 'tenant' };
  if (availability.isAdmin) return { kind: 'admin' };
  return null;
}

function initialsFrom(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p: string) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'
  );
}

interface RenderSidebarArgs {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  workspace: RememberedWorkspace | null;
  availability: Awaited<ReturnType<typeof loadRoleAvailability>>;
  fullName: string;
  initials: string;
  userSub?: string;
}

async function renderSidebarFor({
  supabase,
  userId,
  workspace,
  availability,
  fullName,
  initials,
  userSub,
}: RenderSidebarArgs) {
  if (workspace?.kind === 'landlord') {
    const org = availability.orgs.find((o) => o.slug === workspace.slug);
    if (org) {
      const [subscription, propertyCountResp, badgeCounts] = await Promise.all([
        loadOrgSubscription(org.id),
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', org.id),
        loadSidebarBadgeCounts(supabase, { userId, orgId: org.id }),
      ]);
      const tier = subscription?.tier ?? 'free';
      return (
        <LandlordSidebar
          orgSlug={org.slug}
          orgName={org.name}
          tierLabel={TIER_LABELS[tier] ?? null}
          propertyCount={propertyCountResp.count ?? 0}
          unreadMessages={badgeCounts.unreadMessages}
          unreadNotifications={badgeCounts.unreadNotifications}
          openTickets={badgeCounts.openTickets}
          vacantListings={badgeCounts.vacantListings}
          overdueRent={badgeCounts.overdueRent}
          expiringCompliance={badgeCounts.expiringCompliance}
          rtrRechecksDue={badgeCounts.rtrRechecksDue}
          userInitials={initials}
          userName={fullName}
          userSub={userSub}
        />
      );
    }
  }

  if (workspace?.kind === 'tenant') {
    const [badgeCounts, pendingApplications] = await Promise.all([
      loadSidebarBadgeCounts(supabase, { userId }),
      supabase
        .from('room_applications')
        .select('id', { count: 'exact', head: true })
        .eq('applicant_user_id', userId)
        .eq('status', 'pending'),
    ]);
    return (
      <TenantSidebar
        unreadMessages={badgeCounts.unreadMessages}
        unreadNotifications={badgeCounts.unreadNotifications}
        openTickets={badgeCounts.openTickets}
        pendingApplications={pendingApplications.count ?? 0}
        userInitials={initials}
        userName={fullName}
        userSub={userSub}
      />
    );
  }

  // Admin or no workspace — fall through with no sidebar; the AppShell will
  // render the topbar + content area without a left nav (consistent with
  // how /admin currently renders).
  return undefined;
}
