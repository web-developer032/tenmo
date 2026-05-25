import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { DbError } from '@/lib/errors';
import { assertOrgMember, handler, requireUser } from '@/lib/handler';

const TRADES = [
  'plumbing',
  'electrical',
  'gas',
  'general',
  'security',
  'heating',
  'locksmith',
  'roofing',
  'cleaning',
] as const;

const ContractorInput = z.object({
  name: z.string().trim().min(2).max(120),
  contact_name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  trades: z.array(z.enum(TRADES)).default([]),
  coverage_areas: z.array(z.string().trim().min(1).max(80)).default([]),
  day_rate_pence: z.number().int().nonnegative().max(10_000_000).optional().nullable(),
  gas_safe_number: z.string().trim().max(40).optional().nullable(),
  niceic_number: z.string().trim().max(40).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

/**
 * Contractors directory CRUD for the landlord console.
 *
 * GET — lists every non-archived contractor (RLS keeps queries scoped
 * to the caller's org).
 * POST — adds a new contractor with the fields the design captures.
 */
export const GET = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent', 'staff']);

    const { data, error } = await ctx.supabase
      .from('contractors')
      .select('*')
      .eq('org_id', org.id)
      .is('archived_at', null)
      .order('last_used_at', { ascending: false, nullsFirst: false });
    if (error) throw new DbError(error);

    return NextResponse.json({ data: { contractors: data ?? [] } });
  },
  { requireAuth: true },
);

export const POST = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const user = requireUser(ctx);
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);

    const input = ContractorInput.parse(await ctx.req.json());

    const { data, error } = await ctx.supabase
      .from('contractors')
      .insert({
        org_id: org.id,
        name: input.name,
        contact_name: input.contact_name ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        trades: input.trades,
        coverage_areas: input.coverage_areas,
        day_rate_pence: input.day_rate_pence ?? null,
        gas_safe_number: input.gas_safe_number ?? null,
        niceic_number: input.niceic_number ?? null,
        rating: input.rating ?? null,
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error) throw new DbError(error);

    return NextResponse.json({ data: { contractor: data } }, { status: 201 });
  },
  { requireAuth: true },
);
