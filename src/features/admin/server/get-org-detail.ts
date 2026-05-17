import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionStatus, SubscriptionTier } from '@/core/constants/billing';
import type { OrgSubscription } from '@/core/schemas/billing';
import { DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Read-only detail view of an org for `/admin/orgs/[orgId]`.
 *
 * Returns the org row, its subscription (with override fields),
 * member roster, and a usage snapshot derived from the live tables
 * (properties / tenancies). Counts are computed via PostgREST
 * `head: true, count: 'exact'` requests so we never load the rows.
 */

export interface AdminOrgDetail {
  org: {
    id: string;
    name: string;
    slug: string;
    contact_email: string | null;
    contact_phone: string | null;
    business_address: unknown;
    vat_number: string | null;
    company_number: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  subscription: OrgSubscription | null;
  members: Array<{
    user_id: string;
    role: 'owner' | 'agent' | 'staff';
    full_name: string | null;
    contact_email: string | null;
    accepted_at: string | null;
    revoked_at: string | null;
  }>;
  usage: {
    properties: number;
    rooms: number;
    tenancies: number;
    org_members: number;
  };
}

export async function getOrgDetailWithClient(
  sb: SupabaseClient,
  orgId: string,
): Promise<AdminOrgDetail> {
  const [orgRes, subRes, membersRes, propsCount, roomsCount, tenanciesCount, membersCount] =
    await Promise.all([
      sb
        .from('orgs')
        .select(
          'id, name, slug, contact_email, contact_phone, business_address, vat_number, company_number, created_by, created_at, updated_at',
        )
        .eq('id', orgId)
        .maybeSingle(),
      sb.from('org_subscriptions').select('*').eq('org_id', orgId).maybeSingle(),
      sb
        .from('org_memberships')
        .select('user_id, role, accepted_at, revoked_at, profiles(full_name, contact_email)')
        .eq('org_id', orgId)
        .order('accepted_at', { ascending: true }),
      sb
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('archived_at', null),
      sb
        .from('rooms')
        .select('id, properties!inner(org_id)', { count: 'exact', head: true })
        .eq('properties.org_id', orgId),
      sb
        .from('tenancies')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['active', 'pending']),
      sb
        .from('org_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('revoked_at', null),
    ]);

  if (orgRes.error) throw new DbError(orgRes.error);
  if (!orgRes.data) throw new NotFoundError('Org not found');
  if (subRes.error) throw new DbError(subRes.error);
  if (membersRes.error) throw new DbError(membersRes.error);
  if (propsCount.error) throw new DbError(propsCount.error);
  if (roomsCount.error) throw new DbError(roomsCount.error);
  if (tenanciesCount.error) throw new DbError(tenanciesCount.error);
  if (membersCount.error) throw new DbError(membersCount.error);

  type MemberRow = {
    user_id: string;
    role: 'owner' | 'agent' | 'staff';
    accepted_at: string | null;
    revoked_at: string | null;
    profiles:
      | { full_name: string | null; contact_email: string | null }
      | { full_name: string | null; contact_email: string | null }[]
      | null;
  };

  return {
    org: orgRes.data,
    subscription: (subRes.data as OrgSubscription | null) ?? null,
    members: ((membersRes.data as MemberRow[] | null) ?? []).map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        user_id: m.user_id,
        role: m.role,
        full_name: profile?.full_name ?? null,
        contact_email: profile?.contact_email ?? null,
        accepted_at: m.accepted_at,
        revoked_at: m.revoked_at,
      };
    }),
    usage: {
      properties: propsCount.count ?? 0,
      rooms: roomsCount.count ?? 0,
      tenancies: tenanciesCount.count ?? 0,
      org_members: membersCount.count ?? 0,
    },
  };
}

export function getOrgDetail(ctx: HandlerContext, orgId: string): Promise<AdminOrgDetail> {
  return getOrgDetailWithClient(ctx.supabase, orgId);
}

export type { SubscriptionStatus, SubscriptionTier };
