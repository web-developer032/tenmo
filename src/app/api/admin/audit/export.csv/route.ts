import { ADMIN_EVENT_LABEL, type AdminEventKind } from '@/core/constants/admin';
import {
  assertAdmin,
  csvResponse,
  listAuditWithClient,
  MAX_EXPORT_ROWS,
} from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/audit/export.csv
 *
 * Streams the admin audit log as a CSV using the same filters the
 * list page exposes (`event`, `actor_user_id`, `target_org_id`,
 * `target_user_id`, `search`, `since`). Capped at `MAX_EXPORT_ROWS`
 * to keep the worker memory bounded.
 */
export const GET = handler(async (ctx) => {
  await assertAdmin(ctx);
  const sp = ctx.req.nextUrl.searchParams;
  const sinceParam = sp.get('since');
  const result = await listAuditWithClient(ctx.supabase, {
    event: (sp.get('event') as AdminEventKind) ?? null,
    actorUserId: sp.get('actor_user_id'),
    targetOrgId: sp.get('target_org_id'),
    targetUserId: sp.get('target_user_id'),
    search: sp.get('q'),
    since: sinceParam ? sinceParam : null,
    page: 1,
    perPage: MAX_EXPORT_ROWS,
  });

  return csvResponse('tenantly-admin-audit', result.rows, [
    { header: 'When', value: (r) => r.created_at },
    { header: 'Actor', value: (r) => r.actor_name ?? r.actor_user_id ?? 'System' },
    { header: 'Actor email', value: (r) => r.actor_email ?? '' },
    { header: 'Actor role', value: (r) => r.actor_role ?? '' },
    { header: 'Event', value: (r) => ADMIN_EVENT_LABEL[r.event] ?? r.event },
    { header: 'Target user', value: (r) => r.target_user_id ?? '' },
    { header: 'Target org', value: (r) => r.target_org_id ?? '' },
    { header: 'IP', value: (r) => r.ip_address ?? '' },
    { header: 'User agent', value: (r) => r.user_agent ?? '' },
    { header: 'Payload', value: (r) => (r.payload ? JSON.stringify(r.payload) : '') },
  ]);
});
