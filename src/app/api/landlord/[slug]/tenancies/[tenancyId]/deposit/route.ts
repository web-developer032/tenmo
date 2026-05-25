import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { DbError, NotFoundError } from '@/lib/errors';
import { assertOrgMember, handler } from '@/lib/handler';

const DepositInput = z.object({
  deposit_pence: z.number().int().nonnegative().max(1_000_000).optional(),
  deposit_scheme: z.enum(['dps', 'mydeposits', 'tds']).optional().nullable(),
  deposit_reference: z.string().trim().max(120).optional().nullable(),
  deposit_protected_at: z.string().datetime().optional().nullable(),
  prescribed_information_sent_at: z.string().datetime().optional().nullable(),
});

/**
 * POST /api/landlord/[slug]/tenancies/[tenancyId]/deposit
 *
 * Patch the deposit fields on a tenancy — backs the "Record deposit"
 * modal on /landlord/[slug]/deposits. Only owner/agent can write; staff
 * are read-only via the GET on the deposits page itself.
 */
export const POST = handler<{ slug: string; tenancyId: string }>(
  async (ctx, { slug, tenancyId }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);

    const input = DepositInput.parse(await ctx.req.json());

    const patch: Record<string, unknown> = {};
    if (input.deposit_pence !== undefined) patch.deposit_pence = input.deposit_pence;
    if (input.deposit_scheme !== undefined) patch.deposit_scheme = input.deposit_scheme;
    if (input.deposit_reference !== undefined) patch.deposit_reference = input.deposit_reference;
    if (input.deposit_protected_at !== undefined)
      patch.deposit_protected_at = input.deposit_protected_at;
    if (input.prescribed_information_sent_at !== undefined)
      patch.prescribed_information_sent_at = input.prescribed_information_sent_at;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ data: { ok: true } });
    }

    const { data, error } = await ctx.supabase
      .from('tenancies')
      .update(patch)
      .eq('id', tenancyId)
      .eq('org_id', org.id)
      .select(
        'id, deposit_pence, deposit_scheme, deposit_reference, deposit_protected_at, prescribed_information_sent_at',
      )
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!data) throw new NotFoundError('Tenancy not found');

    return NextResponse.json({ data: { tenancy: data } });
  },
  { requireAuth: true },
);
