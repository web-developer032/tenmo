import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { loadRentMonth } from '@/features/rent/load-rent-month';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * GET /api/landlord/[slug]/rent/export?month=YYYY-MM
 *
 * Streams the selected month's rent ledger as a CSV download.
 * Used by the Export CSV button on /landlord/[slug]/finance.
 */
export const GET = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent', 'staff']);

    const month = ctx.req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
    const data = await loadRentMonth(ctx.supabase, org.id, `${month}-01`);

    const header = [
      'Tenant',
      'Property',
      'Room',
      'Amount',
      'Paid',
      'Due date',
      'Received on',
      'Method',
      'Status',
    ];
    const lines = [
      header.join(','),
      ...data.rows.map((r) =>
        [
          csvEscape(r.tenantName),
          csvEscape(r.propertyName ?? ''),
          csvEscape(r.roomName ?? ''),
          (r.amountPence / 100).toFixed(2),
          (r.paidPence / 100).toFixed(2),
          r.dueDate,
          r.receivedOn ?? '',
          csvEscape(r.method ?? ''),
          r.status,
        ].join(','),
      ),
    ];
    const body = lines.join('\n');
    const filename = `rent-${data.monthIso.slice(0, 7)}-${slug}.csv`;

    return new Response(body, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  },
  { requireAuth: true },
);

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
