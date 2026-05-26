import {
  assertAdmin,
  csvResponse,
  listOrgSummaryWithClient,
  MAX_EXPORT_ROWS,
} from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/orgs/export.csv — Landlords list as CSV.
 *
 * Mirrors the filter shape of /admin/orgs (q, tier, status, sort) so
 * the "Export CSV" button can carry the active view straight into the
 * file. Soft-deleted orgs are excluded by default; `?show_deleted=1`
 * opts them in.
 */
export const GET = handler(async (ctx) => {
  await assertAdmin(ctx);
  const sp = ctx.req.nextUrl.searchParams;
  const sort = (sp.get('sort') as 'newest' | 'mrr' | 'properties' | 'name' | null) ?? 'newest';
  const result = await listOrgSummaryWithClient(ctx.supabase, {
    q: sp.get('q'),
    tier: sp.get('tier'),
    status: sp.get('status'),
    sort,
    showDeleted: sp.get('show_deleted') === '1',
    page: 1,
    perPage: MAX_EXPORT_ROWS,
  });

  return csvResponse('tenantly-landlords', result.rows, [
    { header: 'Org ID', value: (r) => r.org_id },
    { header: 'Name', value: (r) => r.name },
    { header: 'Slug', value: (r) => r.slug },
    { header: 'Owner', value: (r) => r.owner_name ?? '' },
    { header: 'Owner email', value: (r) => r.owner_email ?? '' },
    { header: 'Tier', value: (r) => r.tier ?? '' },
    { header: 'Status', value: (r) => r.status ?? '' },
    { header: 'Override tier', value: (r) => r.override_tier ?? '' },
    { header: 'MRR (pence)', value: (r) => r.mrr_pence },
    { header: 'Currency', value: (r) => r.currency },
    { header: 'Properties', value: (r) => r.property_count },
    { header: 'Active tenancies', value: (r) => r.active_tenancy_count },
    { header: 'Joined', value: (r) => r.created_at },
    { header: 'Deleted at', value: (r) => r.deleted_at ?? '' },
    { header: 'Payment method', value: (r) => r.payment_method_brand ?? '' },
    { header: 'Payment last4', value: (r) => r.payment_method_last4 ?? '' },
    { header: 'Last payment status', value: (r) => r.last_payment_status ?? '' },
    { header: 'Current period end', value: (r) => r.current_period_end ?? '' },
  ]);
});
