import { ComplianceItemCreate, ComplianceListFilter } from '@/core/schemas/compliance';
import { createComplianceItem, listOrgComplianceItems } from '@/features/compliance/server';
import { assertOrgMember, handler, requireUser } from '@/lib/handler';

/**
 * GET  /api/orgs/[orgId]/compliance — list compliance items (members)
 * POST /api/orgs/[orgId]/compliance — create a compliance item (landlord roles)
 */
export const GET = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertOrgMember(ctx, params.orgId);

    const url = new URL(ctx.req.url);
    const filter = ComplianceListFilter.parse({
      property_id: url.searchParams.get('property_id') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      type: url.searchParams.get('type') ?? undefined,
    });

    const items = await listOrgComplianceItems(ctx, params.orgId, filter);
    return Response.json({ data: items });
  },
  { requireAuth: true },
);

export const POST = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertOrgMember(ctx, params.orgId, ['owner', 'agent', 'staff']);
    const user = requireUser(ctx);

    const json = await ctx.req.json().catch(() => ({}));
    const input = ComplianceItemCreate.parse(json);

    const result = await createComplianceItem(ctx, params.orgId, input, user);
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);
