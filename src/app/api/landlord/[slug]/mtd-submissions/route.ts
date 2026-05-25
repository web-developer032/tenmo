import { NextResponse } from 'next/server';
import { CreateMtdSubmissionInput, MtdSubmission } from '@/core/schemas/mtd-submission';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { DbError, ValidationError } from '@/lib/errors';
import { assertOrgMember, handler, requireUser } from '@/lib/handler';

/**
 * Quarterly MTD submissions register.
 *
 * GET — lists the org's submissions, newest first.
 * POST — captures the figures from live data, marks the quarter as
 *        `generated`, and returns the row so the UI can offer a CSV
 *        download. Direct HMRC API submissions are out of scope at
 *        this stage; the `submission_method` defaults to `csv_export`.
 */
export const GET = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent', 'staff']);

    const { data, error } = await ctx.supabase
      .from('mtd_submissions')
      .select('*')
      .eq('org_id', org.id)
      .order('period_end', { ascending: false });
    if (error) throw new DbError(error);

    return NextResponse.json({
      data: { submissions: (data ?? []).map((r) => MtdSubmission.parse(r)) },
    });
  },
  { requireAuth: true },
);

export const POST = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const user = requireUser(ctx);
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);

    const input = CreateMtdSubmissionInput.parse(await ctx.req.json());

    const quarterMatch = input.quarter.match(/^(\d{4})Q([1-4])$/);
    if (!quarterMatch) {
      throw new ValidationError(
        { quarter: input.quarter },
        `Quarter "${input.quarter}" is invalid`,
      );
    }
    const year = Number(quarterMatch[1]);
    const qNum = Number(quarterMatch[2]);
    const startMonth = (qNum - 1) * 3;
    const periodStart = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
    const periodEnd = new Date(Date.UTC(year, startMonth + 3, 0)).toISOString().slice(0, 10);

    const [{ data: payments, error: pErr }, { data: expenses, error: eErr }] = await Promise.all([
      ctx.supabase
        .from('rent_payments')
        .select('amount_pence, paid_at')
        .eq('org_id', org.id)
        .not('paid_at', 'is', null)
        .gte('paid_at', `${periodStart}T00:00:00Z`)
        .lte('paid_at', `${periodEnd}T23:59:59Z`),
      ctx.supabase
        .from('expenses')
        .select('amount_pence')
        .eq('org_id', org.id)
        .eq('mtd_eligible', true)
        .gte('occurred_on', periodStart)
        .lte('occurred_on', periodEnd),
    ]);
    if (pErr) throw new DbError(pErr);
    if (eErr) throw new DbError(eErr);

    const incomePence = (payments ?? []).reduce((sum, p) => sum + p.amount_pence, 0);
    const expensePence = (expenses ?? []).reduce((sum, e) => sum + e.amount_pence, 0);
    const netProfitPence = incomePence - expensePence;

    const { data, error } = await ctx.supabase
      .from('mtd_submissions')
      .upsert(
        {
          org_id: org.id,
          quarter: input.quarter,
          period_start: periodStart,
          period_end: periodEnd,
          status: input.submission_method === 'direct_api' ? 'submitted' : 'generated',
          income_pence: incomePence,
          expense_pence: expensePence,
          net_profit_pence: netProfitPence,
          submission_method: input.submission_method,
          submission_ref: input.submission_ref ?? null,
          submitted_at: input.submission_method === 'direct_api' ? new Date().toISOString() : null,
          notes: input.notes ?? null,
          created_by: user.id,
        },
        { onConflict: 'org_id,quarter' },
      )
      .select('*')
      .single();
    if (error) throw new DbError(error);

    return NextResponse.json({ data: { submission: MtdSubmission.parse(data) } }, { status: 201 });
  },
  { requireAuth: true },
);
