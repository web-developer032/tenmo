import {
  assertAdmin,
  csvResponse,
  listOrgSummaryWithClient,
  MAX_EXPORT_ROWS,
} from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/billing/export.csv — Billing list as CSV.
 *
 * Same filter shape as /admin/billing — uses admin_org_summary +
 * billing-flavour columns (MRR, payment method, last status).
 */
export const GET = handler(async (ctx) => {
  await assertAdmin(ctx);
  const sp = ctx.req.nextUrl.searchParams;
  const sort = (sp.get('sort') as 'newest' | 'mrr' | 'properties' | 'name' | null) ?? 'mrr';
  const result = await listOrgSummaryWithClient(ctx.supabase, {
    q: sp.get('q'),
    tier: sp.get('tier'),
    status: sp.get('status'),
    sort,
    page: 1,
    perPage: MAX_EXPORT_ROWS,
  });

  return csvResponse('tenantly-billing', result.rows, [
    { header: 'Org ID', value: (r) => r.org_id },
    { header: 'Landlord', value: (r) => r.owner_name ?? r.name },
    { header: 'Owner email', value: (r) => r.owner_email ?? '' },
    { header: 'Plan', value: (r) => r.tier ?? '' },
    { header: 'Status', value: (r) => r.status ?? '' },
    { header: 'MRR (pence)', value: (r) => r.mrr_pence },
    { header: 'Currency', value: (r) => r.currency },
    { header: 'Payment method', value: (r) => r.payment_method_brand ?? '' },
    { header: 'Card last4', value: (r) => r.payment_method_last4 ?? '' },
    { header: 'Last payment status', value: (r) => r.last_payment_status ?? '' },
    { header: 'Last failure', value: (r) => r.last_payment_failure_at ?? '' },
    { header: 'Current period end', value: (r) => r.current_period_end ?? '' },
    { header: 'Stripe customer', value: (r) => r.stripe_customer_id ?? '' },
  ]);
});
