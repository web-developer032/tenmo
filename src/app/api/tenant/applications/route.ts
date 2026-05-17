import { listMyApplications } from '@/features/applications/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/tenant/applications — paginated list of the caller's applications.
 *
 * Query params:
 *   ?page=1
 *   ?per_page=20
 */
export const GET = handler(
  async (ctx) => {
    const url = new URL(ctx.req.url);
    const page = url.searchParams.get('page');
    const perPage = url.searchParams.get('per_page');
    const result = await listMyApplications(
      ctx,
      page ? Number(page) : undefined,
      perPage ? Number(perPage) : undefined,
    );
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
