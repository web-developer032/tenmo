import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { RoleAvailability } from './types';

/**
 * Loads role availability for the current user — what orgs they belong to,
 * whether they have any tenancies, and whether they're a platform admin.
 *
 * Called once from the app shell layout so it can render the role switcher
 * with all the user's available contexts.
 */
export async function loadRoleAvailability(): Promise<RoleAvailability> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { orgs: [], hasTenancies: false, isAdmin: false };
  }

  const [memberships, tenancies, admin] = await Promise.all([
    supabase
      .from('org_memberships')
      .select('role, orgs!inner(id, slug, name)')
      .eq('user_id', user.id)
      .is('revoked_at', null),
    supabase
      .from('tenancies')
      .select('id')
      .eq('tenant_user_id', user.id)
      .in('status', ['pending_invite', 'awaiting_signature', 'awaiting_deposit', 'active'])
      .limit(1),
    supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);

  const orgs =
    memberships.data?.map((m) => {
      const org = m.orgs as unknown as { id: string; slug: string; name: string };
      return {
        id: org.id,
        slug: org.slug,
        name: org.name,
        role: m.role as 'owner' | 'agent' | 'staff',
      };
    }) ?? [];

  return {
    orgs,
    hasTenancies: (tenancies.data?.length ?? 0) > 0,
    isAdmin: !!admin.data,
  };
}
