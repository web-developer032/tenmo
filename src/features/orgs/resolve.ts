import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Resolve a landlord org by its slug, scoped to the current user's
 * memberships (RLS-friendly inner join). Returns `null` if the user
 * isn't a member or the slug doesn't exist — pages can call notFound()
 * to avoid leaking org existence.
 */
export async function resolveOrgBySlug(
  slug: string,
): Promise<{ id: string; slug: string; name: string; role: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('orgs')
    .select('id, slug, name, org_memberships!inner(role, revoked_at)')
    .eq('slug', slug)
    .eq('org_memberships.user_id', user.id)
    .is('org_memberships.revoked_at', null)
    .maybeSingle();

  if (error || !data) return null;

  type Membership = { role: string; revoked_at: string | null };
  const memberships = (data.org_memberships ?? []) as Membership[] | Membership;
  const role = Array.isArray(memberships) ? memberships[0]?.role : memberships?.role;

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    role: role ?? 'staff',
  };
}
