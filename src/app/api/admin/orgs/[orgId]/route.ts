import { assertAdmin, getOrgDetail, writeAudit } from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/orgs/[orgId] — admin-only org detail (org row,
 * subscription, member roster, usage counts). Logs an
 * `org_viewed` audit row.
 */
export const GET = handler<{ orgId: string }>(
  async (ctx, { orgId }) => {
    await assertAdmin(ctx);
    const detail = await getOrgDetail(ctx, orgId);
    await writeAudit(ctx, { event: 'org_viewed', targetOrgId: orgId });
    return Response.json({ data: detail });
  },
  { requireAuth: true },
);
