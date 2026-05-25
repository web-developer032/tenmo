import { loadLandlordFinancials } from '@/features/financials/load-landlord-financials';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * GET /api/landlord/[slug]/financials/export
 *
 * Streams a single CSV that contains the org's full income +
 * expense ledger for the current UK tax year (April–March). Used
 * by the "Export for accountant" button on /financials.
 *
 * The bridging spec we follow (FreeAgent / Xero compatible) wants
 * one row per line item with a stable column order, so we emit
 * income rows first then expenses.
 */
export const GET = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent', 'staff']);

    const data = await loadLandlordFinancials(ctx.supabase, org.id);

    const header = [
      'Date',
      'Type',
      'Category',
      'Description',
      'Property',
      'Amount £',
      'MTD eligible',
    ];
    const lines = [header.join(',')];

    for (const m of data.income) {
      lines.push(
        [
          `${m.monthIso}`,
          'income',
          'rent',
          csvEscape(`Rental income — ${m.label}`),
          'All properties',
          (m.receivedPence / 100).toFixed(2),
          'yes',
        ].join(','),
      );
    }
    for (const e of data.expenses) {
      lines.push(
        [
          e.occurredOn,
          'expense',
          e.category,
          csvEscape(e.description),
          csvEscape(e.propertyName ?? 'All properties'),
          (e.amountPence / 100).toFixed(2),
          e.mtdEligible ? 'yes' : 'no',
        ].join(','),
      );
    }

    const body = lines.join('\n');
    const filename = `financials-${data.taxYearLabel.replace('–', '-')}-${slug}.csv`;

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
