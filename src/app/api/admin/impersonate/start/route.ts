import { cookies } from 'next/headers';
import { z } from 'zod';
import { assertSuperAdmin, startImpersonation } from '@/features/admin/impersonation';
import { assertAdmin, getAdminSelf, writeAudit } from '@/features/admin/server';
import { BusinessRuleError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * POST /api/admin/impersonate/start
 * Body: { targetUserId: uuid, reason?: string }
 *
 * Begins impersonating a user. Only super admins may call this. The
 * admin's existing Supabase cookies are stashed under a private
 * backup name and replaced with the target user's session.
 *
 * Returns `{ targetUserId, redirectTo }` where `redirectTo` is the
 * landing page the front-end should `router.replace` to (always the
 * tenant or landlord dashboard, never `/admin` — otherwise the
 * admin's banner would advertise impersonation while sitting on an
 * admin page).
 */

const Body = z
  .object({
    targetUserId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const POST = handler(
  async (ctx) => {
    await assertAdmin(ctx);
    const { supabase, user, req } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    assertSuperAdmin(self.role);

    const json = await req.json().catch(() => ({}));
    const input = Body.parse(json);
    if (input.targetUserId === user.id) {
      throw new BusinessRuleError('Cannot impersonate yourself');
    }

    const reqCookies = await cookies();
    // Next 15 cookies() in route handlers returns a mutable store.
    // The same `cookies()` object exposes both read + write APIs.
    const result = await startImpersonation(
      reqCookies as unknown as Parameters<typeof startImpersonation>[0],
      reqCookies as unknown as Parameters<typeof startImpersonation>[1],
      {
        adminUserId: user.id,
        targetUserId: input.targetUserId,
        reason: input.reason ?? null,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: req.headers.get('user-agent') ?? null,
      },
    );

    await writeAudit(ctx, {
      event: 'impersonation_start',
      targetUserId: result.target.id,
      payload: {
        reason: input.reason ?? null,
        session_id: result.sessionId,
        target_email: result.target.email,
      },
      critical: true,
    });

    return Response.json({
      data: {
        sessionId: result.sessionId,
        target: result.target,
        redirectTo: '/',
      },
    });
  },
  { requireAuth: true },
);
