import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { LandlordSidebar } from '@/components/app-shell/landlord-sidebar';
import { loadSidebarBadgeCounts } from '@/features/app-shell/server';
import { PastDueBanner } from '@/features/billing/components/past-due-banner';
import { loadOrgSubscription } from '@/features/billing/loaders';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };

const TIER_LABELS: Record<string, string> = {
  free: 'Free plan',
  starter: 'Starter plan',
  pro: 'Pro plan',
  portfolio: 'Portfolio plan',
  trial: 'Trial',
};

/**
 * Layout for /landlord/[slug]/* — enforces the user is a member of the org.
 *
 * Renders the AppShell with the landlord sidebar pre-bound to the active
 * org slug. The shell handles the responsive frame (sidebar fixed on lg+,
 * drawer below); this layout is the right place to fetch the small bit of
 * org metadata the sidebar shows in its footer (org name, plan tier).
 */
export default async function LandlordLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/landlord/${slug}`);

  const { data: org, error } = await supabase
    .from('orgs')
    .select('id, slug, name, org_memberships!inner(role, revoked_at)')
    .eq('slug', slug)
    .eq('org_memberships.user_id', user.id)
    .is('org_memberships.revoked_at', null)
    .maybeSingle();

  if (error || !org) {
    notFound();
  }

  const [subscription, profileResp, propertyCountResp, badgeCounts] = await Promise.all([
    loadOrgSubscription(org.id),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
    loadSidebarBadgeCounts(supabase, { userId: user.id, orgId: org.id }),
  ]);

  const tier = subscription?.tier ?? 'free';
  const tierLabel = TIER_LABELS[tier] ?? null;
  const fullName = profileResp.data?.full_name ?? user.email ?? 'Tenantly user';
  const initials =
    fullName
      .split(/\s+/)
      .map((p: string) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const sidebar = (
    <LandlordSidebar
      orgSlug={slug}
      orgName={org.name}
      tierLabel={tierLabel}
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
    />
  );

  return (
    <AppShell
      sidebar={sidebar}
      pageTitle={org.name ?? 'Landlord'}
      pageSubtitle={tierLabel ?? undefined}
    >
      <PastDueBanner status={subscription?.status ?? null} orgSlug={slug} />
      <div className="min-w-0 p-4 lg:p-7">{children}</div>
    </AppShell>
  );
}
