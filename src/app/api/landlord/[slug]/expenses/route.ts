import { NextResponse } from 'next/server';
import { CreateExpenseInput, Expense } from '@/core/schemas/expense';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { DbError } from '@/lib/errors';
import { assertOrgMember, handler, requireUser } from '@/lib/handler';

/**
 * Expense ledger CRUD for the landlord console.
 *
 * GET lists expenses for the org (optionally filtered by category or
 * tax-year window); POST inserts a single row. Both routes are scoped
 * to the org by `slug` and gated by org membership.
 */
export const GET = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent', 'staff']);

    const search = ctx.req.nextUrl.searchParams;
    const category = search.get('category');
    const from = search.get('from');
    const to = search.get('to');
    const limit = Math.min(Number(search.get('limit') ?? 200), 500);

    let q = ctx.supabase
      .from('expenses')
      .select('*')
      .eq('org_id', org.id)
      .order('occurred_on', { ascending: false })
      .limit(limit);
    if (category) q = q.eq('category', category);
    if (from) q = q.gte('occurred_on', from);
    if (to) q = q.lte('occurred_on', to);

    const { data, error } = await q;
    if (error) throw new DbError(error);

    return NextResponse.json({ data: { expenses: (data ?? []).map((r) => Expense.parse(r)) } });
  },
  { requireAuth: true },
);

export const POST = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const user = requireUser(ctx);
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);

    const input = CreateExpenseInput.parse(await ctx.req.json());

    const { data, error } = await ctx.supabase
      .from('expenses')
      .insert({
        org_id: org.id,
        property_id: input.property_id ?? null,
        occurred_on: input.occurred_on,
        description: input.description,
        category: input.category,
        amount_pence: input.amount_pence,
        receipt_document_id: input.receipt_document_id ?? null,
        mtd_eligible: input.mtd_eligible,
        mtd_quarter: input.mtd_quarter ?? null,
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error) throw new DbError(error);

    return NextResponse.json({ data: { expense: Expense.parse(data) } }, { status: 201 });
  },
  { requireAuth: true },
);
