import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * /dispatch — single entry point after login.
 *
 * Routes the user to the right context based on what relationships exist.
 * Roles are derived, not stored on the user; this page is the source of
 * truth for where to land.
 *
 * Priority order:
 *   1. Has org membership      → /landlord/{orgSlug}   (primary "real" work)
 *   2. Has active tenancy      → /tenant
 *   3. Is admin (no other rel) → /admin
 *   4. Otherwise               → /onboarding
 *
 * A platform admin who also dogfoods Tenantly as a landlord/tenant lands
 * on their landlord/tenant workspace; the admin console is reachable
 * directly via `/admin`. A pure admin (no orgs, no tenancies) goes
 * straight to `/admin` instead of being misrouted to onboarding.
 */
export default async function DispatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: memberships }, { data: tenancies }, { data: adminRow }] = await Promise.all([
    supabase
      .from('org_memberships')
      .select('org_id, role, orgs!inner(id, slug)')
      .eq('user_id', user.id)
      .limit(1),
    supabase
      .from('tenancies')
      .select('id, status')
      .eq('tenant_user_id', user.id)
      .in('status', ['pending_invite', 'awaiting_signature', 'awaiting_deposit', 'active'])
      .limit(1),
    supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);

  const firstOrg = memberships?.[0]?.orgs as { slug: string } | undefined;
  if (firstOrg?.slug) {
    redirect(`/landlord/${firstOrg.slug}`);
  }

  if (tenancies && tenancies.length > 0) {
    redirect('/tenant');
  }

  if (adminRow?.user_id) {
    redirect('/admin');
  }

  redirect('/onboarding');
}
