import type { SupabaseClient } from '@supabase/supabase-js';
import { DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Read-only detail view of a user for `/admin/users/[id]`.
 *
 * Aggregates profile + admin status + every org the user belongs
 * to (via `org_memberships`) + every tenancy they hold (via
 * `tenancies.tenant_user_id`). RLS lets admins read everything,
 * so we use the caller-scoped client.
 */

export interface AdminUserDetail {
  profile: {
    id: string;
    full_name: string | null;
    preferred_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    locale: string;
    timezone: string;
    flag_abuse_review: boolean;
    created_at: string;
    updated_at: string;
  };
  is_admin: boolean;
  admin_notes: string | null;
  memberships: Array<{
    org_id: string;
    org_name: string;
    org_slug: string;
    role: 'owner' | 'agent' | 'staff';
    accepted_at: string | null;
    revoked_at: string | null;
  }>;
  tenancies: Array<{
    id: string;
    status: string;
    org_id: string;
    org_name: string;
    property_id: string;
    property_name: string;
    room_id: string | null;
    start_date: string | null;
    end_date: string | null;
  }>;
}

export async function getUserDetailWithClient(
  sb: SupabaseClient,
  userId: string,
): Promise<AdminUserDetail> {
  const [profileRes, adminRes, membershipsRes, tenanciesRes] = await Promise.all([
    sb
      .from('profiles')
      .select(
        'id, full_name, preferred_name, contact_email, contact_phone, locale, timezone, flag_abuse_review, created_at, updated_at',
      )
      .eq('id', userId)
      .maybeSingle(),
    sb.from('admin_users').select('user_id, notes').eq('user_id', userId).maybeSingle(),
    sb
      .from('org_memberships')
      .select('org_id, role, accepted_at, revoked_at, orgs(name, slug)')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false }),
    sb
      .from('tenancies')
      .select(
        'id, status, org_id, property_id, room_id, start_date, end_date, properties(name), orgs(name)',
      )
      .eq('tenant_user_id', userId)
      .order('start_date', { ascending: false }),
  ]);

  if (profileRes.error) throw new DbError(profileRes.error);
  if (!profileRes.data) throw new NotFoundError('User profile not found');
  if (adminRes.error) throw new DbError(adminRes.error);
  if (membershipsRes.error) throw new DbError(membershipsRes.error);
  if (tenanciesRes.error) throw new DbError(tenanciesRes.error);

  type MembershipRow = {
    org_id: string;
    role: 'owner' | 'agent' | 'staff';
    accepted_at: string | null;
    revoked_at: string | null;
    orgs: { name: string; slug: string } | { name: string; slug: string }[] | null;
  };
  type TenancyRow = {
    id: string;
    status: string;
    org_id: string;
    property_id: string;
    room_id: string | null;
    start_date: string | null;
    end_date: string | null;
    properties: { name: string } | { name: string }[] | null;
    orgs: { name: string } | { name: string }[] | null;
  };

  return {
    profile: profileRes.data,
    is_admin: !!adminRes.data,
    admin_notes: adminRes.data?.notes ?? null,
    memberships: ((membershipsRes.data as MembershipRow[] | null) ?? []).map((m) => {
      const org = Array.isArray(m.orgs) ? m.orgs[0] : m.orgs;
      return {
        org_id: m.org_id,
        org_name: org?.name ?? 'Unknown',
        org_slug: org?.slug ?? '',
        role: m.role,
        accepted_at: m.accepted_at,
        revoked_at: m.revoked_at,
      };
    }),
    tenancies: ((tenanciesRes.data as TenancyRow[] | null) ?? []).map((t) => {
      const prop = Array.isArray(t.properties) ? t.properties[0] : t.properties;
      const org = Array.isArray(t.orgs) ? t.orgs[0] : t.orgs;
      return {
        id: t.id,
        status: t.status,
        org_id: t.org_id,
        org_name: org?.name ?? 'Unknown',
        property_id: t.property_id,
        property_name: prop?.name ?? 'Unknown',
        room_id: t.room_id,
        start_date: t.start_date,
        end_date: t.end_date,
      };
    }),
  };
}

export function getUserDetail(ctx: HandlerContext, userId: string): Promise<AdminUserDetail> {
  return getUserDetailWithClient(ctx.supabase, userId);
}
