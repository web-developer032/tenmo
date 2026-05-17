import type { AdminEventKind } from '@/core/constants/admin';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Append a row to `public.admin_audit_log`.
 *
 * Best-effort — never throws on logger-style failures (we want
 * the underlying admin action to succeed even if the log row
 * couldn't be persisted), but DOES throw `DbError` on hard
 * Postgres errors so the route handler can roll back if the
 * caller decides the audit is critical.
 *
 * Pass `critical: true` for security-relevant events (overrides,
 * impersonation) where we'd rather fail the request than lose the
 * audit trail.
 */
export interface WriteAuditInput {
  event: AdminEventKind;
  targetUserId?: string | null;
  targetOrgId?: string | null;
  payload?: Record<string, unknown>;
  critical?: boolean;
}

export async function writeAudit(ctx: HandlerContext, input: WriteAuditInput): Promise<void> {
  const user = requireUser(ctx);
  const ip = extractIp(ctx);
  const userAgent = ctx.req.headers.get('user-agent') ?? null;

  const { error } = await ctx.supabase.from('admin_audit_log').insert({
    actor_user_id: user.id,
    event: input.event,
    target_user_id: input.targetUserId ?? null,
    target_org_id: input.targetOrgId ?? null,
    payload: input.payload ?? {},
    ip_address: ip,
    user_agent: userAgent,
  });

  if (error) {
    ctx.log.error(
      {
        err: error,
        event: input.event,
        targetUserId: input.targetUserId,
        targetOrgId: input.targetOrgId,
      },
      'admin_audit_log insert failed',
    );
    if (input.critical) throw new DbError(error, 'Audit log write failed');
  }
}

/**
 * Best-effort client IP extraction. Trusts the same `x-forwarded-for`
 * header set by Vercel / Cloudflare — first value wins.
 */
function extractIp(ctx: HandlerContext): string | null {
  const forwarded = ctx.req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return ctx.req.headers.get('x-real-ip') ?? null;
}
