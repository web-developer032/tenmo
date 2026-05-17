import { ADMIN_EVENT_KIND_VALUES, type AdminEventKind } from '@/core/constants/admin';
import { AdminListQuery } from '@/core/schemas/admin';
import { assertAdmin, listAudit } from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/audit
 *
 * Paginated read of `admin_audit_log` for the audit page. Supports
 * `event=`, `target_user_id=`, `target_org_id=` filters in addition
 * to the shared `page=` / `per_page=`.
 */
export const GET = handler(
  async (ctx) => {
    await assertAdmin(ctx);

    const search = ctx.req.nextUrl.searchParams;
    const params = AdminListQuery.parse(Object.fromEntries(search));

    const eventParam = search.get('event');
    const event: AdminEventKind | null =
      eventParam && (ADMIN_EVENT_KIND_VALUES as string[]).includes(eventParam)
        ? (eventParam as AdminEventKind)
        : null;

    const result = await listAudit(ctx, {
      page: params.page,
      perPage: params.per_page,
      event,
      targetUserId: search.get('target_user_id'),
      targetOrgId: search.get('target_org_id'),
    });

    return Response.json({ data: result });
  },
  { requireAuth: true },
);
