import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionStatus, SubscriptionTier } from '@/core/constants/billing';
import { buildIlikePattern, computePaginationRange, totalPages } from '@/core/utils/admin-search';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Paginated org list with subscription tier + status badges.
 * Used by `/admin/orgs`. Two entry points share the underlying
 * query — see `list-users.ts` for the rationale.
 */

export interface AdminOrgRow {
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  /** From `org_subscriptions` (null if the org has never had a row inserted). */
  tier: SubscriptionTier | null;
  status: SubscriptionStatus | null;
  override_tier: SubscriptionTier | null;
}

export interface ListOrgsResult {
  rows: AdminOrgRow[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ListOrgsParams {
  q?: string | null;
  page?: number;
  perPage?: number;
}

export async function listOrgsWithClient(
  sb: SupabaseClient,
  params: ListOrgsParams = {},
): Promise<ListOrgsResult> {
  const range = computePaginationRange(params.page, params.perPage);
  const pattern = buildIlikePattern(params.q);

  let query = sb
    .from('orgs')
    .select(
      'id, name, slug, contact_email, contact_phone, created_at, org_subscriptions(tier, status, override_tier)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (pattern) {
    query = query.or(
      [`name.ilike.${pattern}`, `slug.ilike.${pattern}`, `contact_email.ilike.${pattern}`].join(
        ',',
      ),
    );
  }

  const { data, error, count } = await query.range(range.rangeStart, range.rangeEnd);
  if (error) throw new DbError(error);

  type Row = {
    id: string;
    name: string;
    slug: string;
    contact_email: string | null;
    contact_phone: string | null;
    created_at: string;
    // org_id is the PK on org_subscriptions, so PostgREST returns
    // an object (or null) — not an array. We accept both for safety.
    org_subscriptions:
      | {
          tier: SubscriptionTier;
          status: SubscriptionStatus;
          override_tier: SubscriptionTier | null;
        }
      | {
          tier: SubscriptionTier;
          status: SubscriptionStatus;
          override_tier: SubscriptionTier | null;
        }[]
      | null;
  };

  const rows: AdminOrgRow[] = ((data as Row[] | null) ?? []).map((r) => {
    const sub = Array.isArray(r.org_subscriptions) ? r.org_subscriptions[0] : r.org_subscriptions;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      contact_email: r.contact_email,
      contact_phone: r.contact_phone,
      created_at: r.created_at,
      tier: sub?.tier ?? null,
      status: sub?.status ?? null,
      override_tier: sub?.override_tier ?? null,
    };
  });

  return {
    rows,
    total: count ?? 0,
    page: range.page,
    per_page: range.perPage,
    total_pages: totalPages(count ?? 0, range.perPage),
  };
}

export function listOrgs(
  ctx: HandlerContext,
  params: ListOrgsParams = {},
): Promise<ListOrgsResult> {
  return listOrgsWithClient(ctx.supabase, params);
}
