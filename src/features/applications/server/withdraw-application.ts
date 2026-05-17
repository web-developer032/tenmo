import 'server-only';
import { Application } from '@/core/schemas/application';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { notifyApplicationWithdrawn } from './notifications';

/** Applicant withdraws their own pending application. */
export async function withdrawApplication(
  ctx: HandlerContext,
  applicationId: string,
): Promise<Application> {
  const user = requireUser(ctx);

  const { data: existing, error: loadErr } = await ctx.supabase
    .from('room_applications')
    .select('id, status, applicant_user_id')
    .eq('id', applicationId)
    .maybeSingle();
  if (loadErr) throw new DbError(loadErr);
  if (!existing) throw new NotFoundError('Application not found');
  if (existing.applicant_user_id !== user.id) {
    throw new NotFoundError('Application not found');
  }
  if (existing.status !== 'pending') {
    throw new BusinessRuleError(`Cannot withdraw an application with status '${existing.status}'`);
  }

  const { data, error } = await ctx.supabase
    .from('room_applications')
    .update({
      status: 'withdrawn',
      decided_at: new Date().toISOString(),
      decided_by_user_id: user.id,
    })
    .eq('id', applicationId)
    .select('*')
    .single();
  if (error) throw new DbError(error);

  const parsed = Application.parse(data);
  notifyApplicationWithdrawn(parsed.id).catch((err) => {
    ctx.log.warn({ err, applicationId }, 'notifyApplicationWithdrawn failed');
  });
  return parsed;
}
