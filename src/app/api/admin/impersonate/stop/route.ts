import { cookies } from 'next/headers';
import { stopImpersonation } from '@/features/admin/impersonation';
import { writeAudit } from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/admin/impersonate/stop
 *
 * Ends the active impersonation session. Restores the admin's
 * original Supabase auth cookies and stamps `ended_at` on the
 * `admin_impersonation_sessions` row.
 *
 * No authentication is enforced here directly because the caller's
 * Supabase session is currently the target user's. We trust the
 * presence of the `tenantly-admin-original-session` httpOnly cookie
 * as proof of an active impersonation; that cookie was only ever set
 * by `start` which itself requires `super` admin.
 */

export const POST = handler(async (ctx) => {
  const reqCookies = await cookies();
  const result = await stopImpersonation(
    reqCookies as unknown as Parameters<typeof stopImpersonation>[0],
    reqCookies as unknown as Parameters<typeof stopImpersonation>[1],
  );

  // The cookie swap has completed but `ctx.user` still points at the
  // target user — we override the audit insert via service role to
  // attribute the event to the admin who is now restored.
  if (result.adminUserId) {
    const { createServiceClient } = await import('@/lib/supabase/service');
    const svc = createServiceClient();
    await svc.from('admin_audit_log').insert({
      actor_user_id: result.adminUserId,
      event: 'impersonation_end',
      payload: {
        session_id: result.sessionId,
        duration_seconds: result.durationSeconds,
      },
      ip_address: ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: ctx.req.headers.get('user-agent') ?? null,
    });
  } else {
    // Best-effort fallback: write the audit under the current
    // (restored) caller. Will silently skip if RLS denies.
    await writeAudit(ctx, {
      event: 'impersonation_end',
      payload: {
        session_id: result.sessionId,
        duration_seconds: result.durationSeconds,
      },
    });
  }

  return Response.json({
    data: {
      sessionId: result.sessionId,
      durationSeconds: result.durationSeconds,
      redirectTo: '/admin',
    },
  });
});
