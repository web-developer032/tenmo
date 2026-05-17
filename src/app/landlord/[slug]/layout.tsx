import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { LandlordSidebar } from '@/components/app-shell/landlord-sidebar';
import { PastDueBanner } from '@/features/billing/components/past-due-banner';
import { loadOrgSubscription } from '@/features/billing/loaders';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };

/**
 * Layout for /landlord/[slug]/* — enforces the user is a member of the org.
 *
 * Renders the AppShell (which itself ensures the user is signed in) and verifies
 * the org exists and the user has an active membership. RLS makes a
 * non-membership produce no rows; we treat that as 404 to avoid leaking the
 * existence of orgs the user can't see.
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
    .select('id, slug, org_memberships!inner(role, revoked_at)')
    .eq('slug', slug)
    .eq('org_memberships.user_id', user.id)
    .is('org_memberships.revoked_at', null)
    .maybeSingle();

  if (error || !org) {
    notFound();
  }

  const subscription = await loadOrgSubscription(org.id);

  return (
    <AppShell>
      <PastDueBanner status={subscription?.status ?? null} orgSlug={slug} />
      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-[220px_1fr] gap-0">
        <aside className="hidden border-r min-h-[calc(100dvh-3.5rem)] md:block">
          <LandlordSidebar orgSlug={slug} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}
