import {
  assertAdmin,
  csvResponse,
  listComplianceViolationsWithClient,
  MAX_EXPORT_ROWS,
} from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/compliance/export.csv — Compliance violations as CSV.
 */
export const GET = handler(async (ctx) => {
  await assertAdmin(ctx);
  const sp = ctx.req.nextUrl.searchParams;
  const result = await listComplianceViolationsWithClient(ctx.supabase, {
    q: sp.get('q'),
    severity: sp.get('severity') as 'all' | 'critical' | 'warning' | 'info' | null,
    kind: sp.get('kind'),
    page: 1,
    perPage: MAX_EXPORT_ROWS,
  });

  return csvResponse('tenantly-compliance', result.rows, [
    { header: 'Kind', value: (r) => r.kind },
    { header: 'Severity', value: (r) => r.severity },
    { header: 'Landlord', value: (r) => r.landlord_name ?? '' },
    { header: 'Org slug', value: (r) => r.org_slug ?? '' },
    { header: 'Subject', value: (r) => r.subject ?? '' },
    { header: 'Details', value: (r) => r.details ?? '' },
    { header: 'Days outstanding', value: (r) => r.days_outstanding },
    { header: 'Reference date', value: (r) => r.reference_date ?? '' },
    { header: 'Created', value: (r) => r.created_at },
  ]);
});
