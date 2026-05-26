import {
  assertAdmin,
  csvResponse,
  listTenantsWithClient,
  MAX_EXPORT_ROWS,
} from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/tenants/export.csv — Tenants list as CSV.
 *
 * Carries the same q/status/portal/sort filters as /admin/tenants.
 */
export const GET = handler(async (ctx) => {
  await assertAdmin(ctx);
  const sp = ctx.req.nextUrl.searchParams;
  const sort = (sp.get('sort') as 'newest' | 'rent' | 'landlord' | null) ?? 'newest';
  const result = await listTenantsWithClient(ctx.supabase, {
    q: sp.get('q'),
    status: sp.get('status'),
    portal: sp.get('portal'),
    sort,
    page: 1,
    perPage: MAX_EXPORT_ROWS,
  });

  function addressLine(addr: Record<string, unknown> | null): string {
    if (!addr) return '';
    const parts = [addr.line1, addr.city, addr.postcode].filter(Boolean);
    return parts.join(', ');
  }

  return csvResponse('tenantly-tenants', result.rows, [
    { header: 'Tenancy ID', value: (r) => r.tenancy_id },
    { header: 'Tenant', value: (r) => r.tenant_name ?? '' },
    { header: 'Tenant email', value: (r) => r.tenant_email ?? '' },
    { header: 'Landlord', value: (r) => r.landlord_name ?? '' },
    { header: 'Org name', value: (r) => r.org_name },
    { header: 'Property', value: (r) => addressLine(r.property_address) },
    { header: 'Room', value: (r) => r.room_name ?? '' },
    { header: 'Status', value: (r) => r.tenancy_status },
    { header: 'Portal status', value: (r) => r.portal_status },
    { header: 'Start', value: (r) => r.start_date ?? '' },
    { header: 'End', value: (r) => r.end_date ?? '' },
    { header: 'Rent (pence)', value: (r) => r.rent_pence },
    { header: 'Rent currency', value: (r) => r.rent_currency },
    { header: 'Rent frequency', value: (r) => r.rent_frequency },
    { header: 'Joined', value: (r) => r.created_at },
  ]);
});
