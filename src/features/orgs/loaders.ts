import 'server-only';
import type { Org, OrgRole } from '@/core/schemas/org';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side loaders for org settings & admin pages.
 *
 * Centralised here so settings, ticket assignment, billing and admin pages
 * share one source of truth for "give me the org row" / "give me the
 * members list" instead of each feature rolling its own query and stitching
 * profiles in slightly different ways. Anything that needs richer data
 * (audit history, invitations) should extend these loaders rather than
 * forking them.
 */

/** A member of an org, joined with their profile and membership timestamps. */
export type OrgMember = {
  user_id: string;
  role: OrgRole;
  full_name: string | null;
  contact_email: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

/**
 * Full org row by id. Returns `null` when the user can't see the org under
 * RLS (mirrors `resolveOrgBySlug` which reads via the slug).
 */
export async function loadOrgDetail(orgId: string): Promise<Org | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('orgs').select('*').eq('id', orgId).maybeSingle();
  if (error || !data) return null;
  return data as Org;
}

/**
 * Active (non-revoked) members of an org, with name + email pulled from
 * `profiles` in a second query.
 *
 * NOTE: We deliberately do *not* embed `profiles` here —
 * `org_memberships.user_id` foreign-keys `auth.users(id)`, not
 * `profiles(id)`, so PostgREST returns PGRST200 if you try
 * `profiles:user_id (...)`. Same approach as
 * `features/admin/server/list-users.ts` and
 * `features/tickets/loaders.ts:loadOrgAssignmentMembers`.
 */
export async function loadOrgMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from('org_memberships')
    .select('user_id, role, invited_at, accepted_at, created_at')
    .eq('org_id', orgId)
    .is('revoked_at', null);
  if (error) throw error;

  const rows = memberships ?? [];
  if (rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, contact_email')
    .in('id', userIds);

  const profileById = new Map<string, { full_name: string | null; contact_email: string | null }>(
    (profiles ?? []).map((p) => [
      p.id,
      { full_name: p.full_name ?? null, contact_email: p.contact_email ?? null },
    ]),
  );

  const ROLE_ORDER: Record<OrgRole, number> = { owner: 0, agent: 1, staff: 2 };
  return rows
    .map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        user_id: row.user_id,
        role: row.role as OrgRole,
        full_name: profile?.full_name ?? null,
        contact_email: profile?.contact_email ?? null,
        invited_at: row.invited_at ?? null,
        accepted_at: row.accepted_at ?? null,
        created_at: row.created_at,
      };
    })
    .sort((a, b) => {
      const byRole = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
      if (byRole !== 0) return byRole;
      return (a.full_name ?? a.contact_email ?? '').localeCompare(
        b.full_name ?? b.contact_email ?? '',
      );
    });
}
