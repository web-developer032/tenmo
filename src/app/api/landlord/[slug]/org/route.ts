import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { DbError } from '@/lib/errors';
import { assertOrgMember, handler } from '@/lib/handler';

const OrgPatch = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  vat_number: z.string().trim().max(40).optional().nullable(),
  company_number: z.string().trim().max(40).optional().nullable(),
});

/**
 * PATCH /api/landlord/[slug]/org
 *
 * Updates business-level fields shown on /landlord/[slug]/profile.
 * Owner role only — agents/staff can read but never rewrite the
 * business identity.
 */
export const PATCH = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner']);

    const input = OrgPatch.parse(await ctx.req.json());
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.contact_email !== undefined) patch.contact_email = input.contact_email;
    if (input.contact_phone !== undefined) patch.contact_phone = input.contact_phone;
    if (input.vat_number !== undefined) patch.vat_number = input.vat_number;
    if (input.company_number !== undefined) patch.company_number = input.company_number;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ data: { ok: true } });
    }

    const { data, error } = await ctx.supabase
      .from('orgs')
      .update(patch)
      .eq('id', org.id)
      .select('id, name, contact_email, contact_phone, vat_number, company_number')
      .maybeSingle();
    if (error) throw new DbError(error);

    return NextResponse.json({ data: { org: data } });
  },
  { requireAuth: true },
);
