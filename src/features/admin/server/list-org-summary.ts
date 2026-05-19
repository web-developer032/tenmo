import type { SupabaseClient } from '@supabase/supabase-js';
import { computePaginationRange, totalPages } from '@/core/utils/admin-search';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Landlord summary query used by `/admin/orgs` (label: "Landlords").
 *
 * Reads `admin_org_summary` so the page gets the pre-joined org +
 * owner + counts + MRR + billing fields in a single round trip.
 * Filterable by tier, status, free-text search and sortable by
 * newest / MRR / property count / name.
 */

export type AdminOrgSummaryRow = {
  org_id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  created_at: string;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  tier: string | null;
  status: string | null;
  override_tier: string | null;
  mrr_pence: number;
  currency: string;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  last_payment_status: string | null;
  last_payment_failure_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  property_count: number;
  active_tenancy_count: number;
};

export type ListOrgSummaryParams = {
  q?: string | null;
  tier?: string | null;
  status?: string | null;
  sort?: 'newest' | 'mrr' | 'properties' | 'name';
  page?: number;
  perPage?: number;
};

export type ListOrgSummaryResult = {
  rows: AdminOrgSummaryRow[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export async function listOrgSummaryWithClient(
  sb: SupabaseClient,
  params: ListOrgSummaryParams = {},
): Promise<ListOrgSummaryResult> {
  const range = computePaginationRange(params.page, params.perPage);

  let query = sb.from('admin_org_summary').select('*', { count: 'exact' });

  if (params.q && params.q.trim().length > 0) {
    const term = `%${params.q.trim()}%`;
    query = query.or(
      [
        `name.ilike.${term}`,
        `slug.ilike.${term}`,
        `contact_email.ilike.${term}`,
        `owner_email.ilike.${term}`,
        `owner_name.ilike.${term}`,
      ].join(','),
    );
  }

  if (params.tier && params.tier !== 'all') {
    if (params.tier === 'trialing' || params.tier === 'trial') {
      query = query.eq('status', 'trialing');
    } else {
      query = query.eq('tier', params.tier);
    }
  }
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  switch (params.sort) {
    case 'mrr':
      query = query.order('mrr_pence', { ascending: false });
      break;
    case 'properties':
      query = query.order('property_count', { ascending: false });
      break;
    case 'name':
      query = query.order('name', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query.range(range.rangeStart, range.rangeEnd);
  if (error) throw new DbError(error);

  const rows: AdminOrgSummaryRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    org_id: r.org_id as string,
    name: r.name as string,
    slug: r.slug as string,
    contact_email: (r.contact_email as string | null) ?? null,
    created_at: r.created_at as string,
    owner_user_id: (r.owner_user_id as string | null) ?? null,
    owner_name: (r.owner_name as string | null) ?? null,
    owner_email: (r.owner_email as string | null) ?? null,
    tier: (r.tier as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    override_tier: (r.override_tier as string | null) ?? null,
    mrr_pence: Number(r.mrr_pence ?? 0),
    currency: (r.currency as string) ?? 'GBP',
    payment_method_brand: (r.payment_method_brand as string | null) ?? null,
    payment_method_last4: (r.payment_method_last4 as string | null) ?? null,
    last_payment_status: (r.last_payment_status as string | null) ?? null,
    last_payment_failure_at: (r.last_payment_failure_at as string | null) ?? null,
    current_period_end: (r.current_period_end as string | null) ?? null,
    stripe_customer_id: (r.stripe_customer_id as string | null) ?? null,
    property_count: Number(r.property_count ?? 0),
    active_tenancy_count: Number(r.active_tenancy_count ?? 0),
  }));

  return {
    rows,
    total: count ?? 0,
    page: range.page,
    per_page: range.perPage,
    total_pages: totalPages(count ?? 0, range.perPage),
  };
}

export function listOrgSummary(
  ctx: HandlerContext,
  params: ListOrgSummaryParams = {},
): Promise<ListOrgSummaryResult> {
  return listOrgSummaryWithClient(ctx.supabase, params);
}
