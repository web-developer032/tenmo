import { z } from 'zod';
import { uuid } from '@/core/schemas/common';
import { seedRequiredItemsForProperty } from '@/features/compliance/server';
import { assertOrgMember, handler } from '@/lib/handler';

const SeedInput = z.object({ property_id: uuid });

/**
 * POST /api/orgs/[orgId]/compliance/seed
 *
 * Creates blank `compliance_items` rows for the certificates the given
 * property is legally required to hold. Idempotent — existing items are
 * preserved. Returns the full set of items for the property.
 */
export const POST = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertOrgMember(ctx, params.orgId, ['owner', 'agent', 'staff']);

    const json = await ctx.req.json().catch(() => ({}));
    const { property_id } = SeedInput.parse(json);

    const items = await seedRequiredItemsForProperty(ctx, property_id);
    return Response.json({ data: items });
  },
  { requireAuth: true },
);
