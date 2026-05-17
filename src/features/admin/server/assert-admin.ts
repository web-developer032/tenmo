import { AppError, ErrorCode, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Throws if the caller is not a platform admin.
 *
 * On the API surface we throw `NotFoundError` rather than `Forbidden`
 * to mirror the `/admin` layout — admins should not be detectable
 * by probing endpoints. The thrown error carries `not_admin` in its
 * details so the client can distinguish "you don't exist" from a
 * genuine 404 (the request id stays the same so the log line still
 * tells us the truth).
 */
export async function assertAdmin(ctx: HandlerContext): Promise<void> {
  const user = requireUser(ctx);
  const { data, error } = await ctx.supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    ctx.log.error({ err: error }, 'admin lookup failed');
    throw new AppError(500, ErrorCode.db_error, 'Admin lookup failed');
  }
  if (!data) throw new NotFoundError();
}
