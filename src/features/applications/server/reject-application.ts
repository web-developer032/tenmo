import 'server-only';
import { Application, type ApplicationRejectInput } from '@/core/schemas/application';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { notifyApplicationRejected } from './notifications';

/**
 * Landlord-side reject. RLS already restricts the UPDATE to landlord roles
 * in the room's org, so no extra membership check is needed.
 */
export async function rejectApplication(
  ctx: HandlerContext,
  applicationId: string,
  input: ApplicationRejectInput,
): Promise<Application> {
  const user = requireUser(ctx);

  const { data: existing, error: loadErr } = await ctx.supabase
    .from('room_applications')
    .select('id, status')
    .eq('id', applicationId)
    .maybeSingle();
  if (loadErr) throw new DbError(loadErr);
  if (!existing) throw new NotFoundError('Application not found');
  if (existing.status !== 'pending') {
    throw new BusinessRuleError(`Cannot reject an application with status '${existing.status}'`);
  }

  const { data, error } = await ctx.supabase
    .from('room_applications')
    .update({
      status: 'rejected',
      decline_reason: input.decline_reason,
      decided_at: new Date().toISOString(),
      decided_by_user_id: user.id,
    })
    .eq('id', applicationId)
    .select('*')
    .single();
  if (error) throw new DbError(error);

  const parsed = Application.parse(data);
  notifyApplicationRejected(parsed.id).catch((err) => {
    ctx.log.warn({ err, applicationId }, 'notifyApplicationRejected failed');
  });
  return parsed;
}
