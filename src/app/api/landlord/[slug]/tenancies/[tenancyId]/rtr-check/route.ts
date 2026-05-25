import { NextResponse } from 'next/server';
import { z } from 'zod';
import { uuid } from '@/core/schemas/common';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { DbError, NotFoundError } from '@/lib/errors';
import { assertOrgMember, handler } from '@/lib/handler';

const RtrInput = z.object({
  document_type: z.enum(['british_passport', 'brp_card', 'share_code', 'eu_settlement', 'other']),
  share_code: z.string().trim().max(40).optional().nullable(),
  expires_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional()
    .nullable(),
  evidence_document_id: uuid.optional().nullable(),
  checked_at: z.string().datetime().optional(),
});

/**
 * POST /api/landlord/[slug]/tenancies/[tenancyId]/rtr-check
 *
 * Records (or re-records) a Right-to-Rent check on a tenancy. Writes
 * the four `rtr_*` columns added in `20260524000000_landlord_ops_platform`
 * plus the existing `rtr_check_completed_at` timestamp so the
 * verification status updates immediately.
 */
export const POST = handler<{ slug: string; tenancyId: string }>(
  async (ctx, { slug, tenancyId }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);

    const input = RtrInput.parse(await ctx.req.json());

    const { data, error } = await ctx.supabase
      .from('tenancies')
      .update({
        rtr_document_type: input.document_type,
        rtr_share_code: input.share_code ?? null,
        rtr_expires_at: input.expires_at ?? null,
        rtr_evidence_document_id: input.evidence_document_id ?? null,
        rtr_check_completed_at: input.checked_at ?? new Date().toISOString(),
      })
      .eq('id', tenancyId)
      .eq('org_id', org.id)
      .select(
        'id, rtr_check_completed_at, rtr_document_type, rtr_share_code, rtr_expires_at, rtr_evidence_document_id',
      )
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!data) throw new NotFoundError('Tenancy not found');

    return NextResponse.json({ data: { tenancy: data } });
  },
  { requireAuth: true },
);
