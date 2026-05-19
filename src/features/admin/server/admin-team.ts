import type { SupabaseClient } from '@supabase/supabase-js';
import { DbError } from '@/lib/errors';
import type { AdminRole } from './get-admin-self';

/**
 * Loader for the admin team management page.
 *
 * Returns every row in `admin_users` joined with the corresponding
 * `profiles` row (for full_name + contact_email) plus every pending
 * row in `admin_invites`.
 */

export type AdminTeamMember = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  role: AdminRole;
  status: 'active' | 'disabled';
  two_factor_enabled: boolean;
  last_active_at: string | null;
  created_at: string;
};

export type AdminPendingInvite = {
  id: string;
  email: string;
  role: AdminRole;
  invited_by_name: string | null;
  expires_at: string;
  created_at: string;
};

export type AdminTeamData = {
  members: AdminTeamMember[];
  invites: AdminPendingInvite[];
};

export async function getAdminTeamWithClient(sb: SupabaseClient): Promise<AdminTeamData> {
  const [admins, invites] = await Promise.all([
    sb
      .from('admin_users')
      .select(
        'user_id, role, display_name, status, two_factor_enabled, last_active_at, created_at, profiles:user_id(full_name, contact_email)',
      )
      .order('created_at', { ascending: true }),
    sb
      .from('admin_invites')
      .select('id, email, role, expires_at, created_at, profiles:invited_by(full_name)')
      .is('consumed_at', null)
      .order('created_at', { ascending: false }),
  ]);

  if (admins.error) throw new DbError(admins.error);
  if (invites.error) throw new DbError(invites.error);

  const members: AdminTeamMember[] = ((admins.data ?? []) as Array<Record<string, unknown>>).map(
    (r) => {
      const profile = r.profiles as {
        full_name: string | null;
        contact_email: string | null;
      } | null;
      return {
        user_id: r.user_id as string,
        email: profile?.contact_email ?? null,
        full_name: profile?.full_name ?? null,
        display_name: (r.display_name as string | null) ?? null,
        role: ((r.role as string) ?? 'super') as AdminRole,
        status: ((r.status as string) ?? 'active') as 'active' | 'disabled',
        two_factor_enabled: Boolean(r.two_factor_enabled),
        last_active_at: (r.last_active_at as string | null) ?? null,
        created_at: r.created_at as string,
      };
    },
  );

  const pending: AdminPendingInvite[] = (
    (invites.data ?? []) as Array<Record<string, unknown>>
  ).map((r) => {
    const profile = r.profiles as { full_name: string | null } | null;
    return {
      id: r.id as string,
      email: r.email as string,
      role: r.role as AdminRole,
      invited_by_name: profile?.full_name ?? null,
      expires_at: r.expires_at as string,
      created_at: r.created_at as string,
    };
  });

  return { members, invites: pending };
}
