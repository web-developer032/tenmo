import { NextResponse } from 'next/server';
import { z } from 'zod';
import { uuid } from '@/core/schemas/common';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { DbError } from '@/lib/errors';
import { assertOrgMember, handler, requireUser } from '@/lib/handler';

const InspectionInput = z.object({
  property_id: uuid,
  room_id: uuid.optional().nullable(),
  tenancy_id: uuid.optional().nullable(),
  type: z
    .enum(['routine_quarterly', 'move_in', 'move_out', 'interim', 'compliance'])
    .default('routine_quarterly'),
  scheduled_for: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inspector_name: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

/**
 * POST /api/landlord/[slug]/inspections
 *
 * Schedules a new inspection for the landlord console. Status defaults
 * to `scheduled` — the page surfaces the row as `overdue` automatically
 * once the scheduled date passes.
 */
export const POST = handler<{ slug: string }>(
  async (ctx, { slug }) => {
    const user = requireUser(ctx);
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);

    const input = InspectionInput.parse(await ctx.req.json());

    const { data, error } = await ctx.supabase
      .from('inspections')
      .insert({
        org_id: org.id,
        property_id: input.property_id,
        room_id: input.room_id ?? null,
        tenancy_id: input.tenancy_id ?? null,
        type: input.type,
        scheduled_for: input.scheduled_for,
        inspector_name: input.inspector_name ?? null,
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error) throw new DbError(error);

    return NextResponse.json({ data: { inspection: data } }, { status: 201 });
  },
  { requireAuth: true },
);
