import { AdminListQuery } from '@/core/schemas/admin';
import { assertAdmin, listUsers } from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/users
 *
 * Admin-only paginated list. Returns 404 (via the assertAdmin
 * helper) for non-admins so the route's existence isn't leaked.
 */
export const GET = handler(
  async (ctx) => {
    await assertAdmin(ctx);

    const params = AdminListQuery.parse(Object.fromEntries(ctx.req.nextUrl.searchParams));
    const result = await listUsers(ctx, {
      q: params.q ?? null,
      page: params.page,
      perPage: params.per_page,
    });

    return Response.json({ data: result });
  },
  { requireAuth: true },
);
