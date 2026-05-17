import { assertAdmin, getUserDetail, writeAudit } from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/users/[userId]
 *
 * Admin-only profile detail. Reading is itself an audited
 * event — `user_viewed` — so the org's privacy posture is
 * honest about who looked at whose data.
 */
export const GET = handler<{ userId: string }>(
  async (ctx, { userId }) => {
    await assertAdmin(ctx);
    const detail = await getUserDetail(ctx, userId);
    await writeAudit(ctx, { event: 'user_viewed', targetUserId: userId });
    return Response.json({ data: detail });
  },
  { requireAuth: true },
);
