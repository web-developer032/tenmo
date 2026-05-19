import type { SupabaseClient } from '@supabase/supabase-js';
import { computePaginationRange, totalPages } from '@/core/utils/admin-search';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Tenants list query — `admin_tenant_summary` view.
 *
 * Filters: free-text search (name, email, property), tenancy status
 * (active/pending/ended), sort by newest, rent or landlord name.
 */

export type AdminTenantRow = {
  tenancy_id: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  property_id: string | null;
  property_address: Record<string, unknown> | null;
  room_id: string | null;
  room_name: string | null;
  tenant_user_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  landlord_name: string | null;
  tenancy_status: string;
  start_date: string | null;
  end_date: string | null;
  rent_pence: number;
  rent_currency: string;
  rent_frequency: string;
  portal_status: string;
  created_at: string;
};

export type ListTenantsParams = {
  q?: string | null;
  status?: string | null;
  portal?: string | null;
  sort?: 'newest' | 'rent' | 'landlord';
  page?: number;
  perPage?: number;
};

export type ListTenantsResult = {
  rows: AdminTenantRow[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export async function listTenantsWithClient(
  sb: SupabaseClient,
  params: ListTenantsParams = {},
): Promise<ListTenantsResult> {
  const range = computePaginationRange(params.page, params.perPage);

  let query = sb.from('admin_tenant_summary').select('*', { count: 'exact' });

  if (params.q && params.q.trim().length > 0) {
    const term = `%${params.q.trim()}%`;
    query = query.or(
      [
        `tenant_name.ilike.${term}`,
        `tenant_email.ilike.${term}`,
        `landlord_name.ilike.${term}`,
        `org_name.ilike.${term}`,
        `room_name.ilike.${term}`,
      ].join(','),
    );
  }
  if (params.status && params.status !== 'all') {
    query = query.eq('tenancy_status', params.status);
  }
  if (params.portal && params.portal !== 'all') {
    query = query.eq('portal_status', params.portal);
  }

  switch (params.sort) {
    case 'rent':
      query = query.order('rent_pence', { ascending: false });
      break;
    case 'landlord':
      query = query.order('landlord_name', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query.range(range.rangeStart, range.rangeEnd);
  if (error) throw new DbError(error);

  const rows: AdminTenantRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    tenancy_id: r.tenancy_id as string,
    org_id: r.org_id as string,
    org_name: r.org_name as string,
    org_slug: r.org_slug as string,
    property_id: (r.property_id as string | null) ?? null,
    property_address: (r.property_address as Record<string, unknown> | null) ?? null,
    room_id: (r.room_id as string | null) ?? null,
    room_name: (r.room_name as string | null) ?? null,
    tenant_user_id: (r.tenant_user_id as string | null) ?? null,
    tenant_name: (r.tenant_name as string | null) ?? null,
    tenant_email: (r.tenant_email as string | null) ?? null,
    landlord_name: (r.landlord_name as string | null) ?? null,
    tenancy_status: r.tenancy_status as string,
    start_date: (r.start_date as string | null) ?? null,
    end_date: (r.end_date as string | null) ?? null,
    rent_pence: Number(r.rent_pence ?? 0),
    rent_currency: (r.rent_currency as string) ?? 'GBP',
    rent_frequency: (r.rent_frequency as string) ?? 'monthly',
    portal_status: (r.portal_status as string) ?? 'invited',
    created_at: r.created_at as string,
  }));

  return {
    rows,
    total: count ?? 0,
    page: range.page,
    per_page: range.perPage,
    total_pages: totalPages(count ?? 0, range.perPage),
  };
}

export function listTenants(
  ctx: HandlerContext,
  params: ListTenantsParams = {},
): Promise<ListTenantsResult> {
  return listTenantsWithClient(ctx.supabase, params);
}
