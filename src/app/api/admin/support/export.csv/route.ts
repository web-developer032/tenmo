import {
  assertAdmin,
  csvResponse,
  listSupportTicketsWithClient,
  MAX_EXPORT_ROWS,
} from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/support/export.csv — Support tickets as CSV.
 *
 * Mirrors /admin/support filters: q, status, priority, tab (filter),
 * assignee. The page shows ~25 rows per page; the export pulls up to
 * MAX_EXPORT_ROWS.
 */
export const GET = handler(async (ctx) => {
  await assertAdmin(ctx);
  const sp = ctx.req.nextUrl.searchParams;
  const result = await listSupportTicketsWithClient(ctx.supabase, {
    q: sp.get('q'),
    status: sp.get('status') as 'all' | 'open' | 'in_progress' | 'resolved' | null,
    priority: sp.get('priority') as 'all' | 'low' | 'med' | 'high' | null,
    filter: sp.get('tab') as 'all' | 'high' | 'unassigned' | 'resolved' | null,
    assignee: sp.get('assignee'),
    callerId: ctx.user?.id ?? null,
    page: 1,
    perPage: MAX_EXPORT_ROWS,
  });

  return csvResponse('tenantly-support', result.rows, [
    { header: 'Ref', value: (r) => r.ref_number },
    { header: 'Title', value: (r) => r.title },
    { header: 'Category', value: (r) => r.category },
    { header: 'Priority', value: (r) => r.priority },
    { header: 'Status', value: (r) => r.status },
    { header: 'Reporter', value: (r) => r.reporter_name ?? '' },
    { header: 'Reporter email', value: (r) => r.reporter_email ?? '' },
    { header: 'Org', value: (r) => r.org_name ?? '' },
    { header: 'Assignee', value: (r) => r.assignee_name ?? '' },
    { header: 'Created', value: (r) => r.created_at },
    { header: 'Resolved', value: (r) => r.resolved_at ?? '' },
    { header: 'Description', value: (r) => r.description ?? '' },
  ]);
});
