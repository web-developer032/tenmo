import { AdminListQuery } from '@/core/schemas/admin';
import { assertAdmin, listOrgs } from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/orgs — admin-only paginated org list with
 * subscription badges.
 */
export const GET = handler(
  async (ctx) => {
    await assertAdmin(ctx);
    const params = AdminListQuery.parse(Object.fromEntries(ctx.req.nextUrl.searchParams));
    const result = await listOrgs(ctx, {
      q: params.q ?? null,
      page: params.page,
      perPage: params.per_page,
    });
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
