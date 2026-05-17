import { Tenancy, type TenancyEnd, type TenancyEndReason } from '@/core/schemas/tenancy';
import { isEndDateValid, noticeDaysForEndReason } from '@/core/utils/tenancy-rules';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Land an `ended` status on a tenancy after validating the Renters' Rights
 * Bill notice floor for the chosen reason. Frees the room back to `available`.
 *
 * Throws BusinessRuleError if the proposed `end_date` doesn't honour the
 * minimum statutory notice for the reason.
 */
export async function endTenancy(
  ctx: HandlerContext,
  tenancyId: string,
  input: TenancyEnd,
): Promise<ReturnType<typeof Tenancy.parse>> {
  const { data: existing, error: loadErr } = await ctx.supabase
    .from('tenancies')
    .select('id, org_id, room_id, status, start_date')
    .eq('id', tenancyId)
    .maybeSingle();

  if (loadErr) throw new DbError(loadErr);
  if (!existing) throw new NotFoundError('Tenancy not found');

  if (existing.status === 'ended' || existing.status === 'cancelled') {
    throw new BusinessRuleError('Tenancy is already closed');
  }

  if (input.end_date < existing.start_date) {
    throw new BusinessRuleError('End date cannot be before the tenancy start date');
  }

  if (!isEndDateValid(input.end_date, input.reason as TenancyEndReason)) {
    const required = noticeDaysForEndReason(input.reason as TenancyEndReason);
    throw new BusinessRuleError(
      `Insufficient notice: '${input.reason}' requires at least ${required} days. ` +
        `Section 21 (no-fault) is abolished under the Renters' Rights Bill.`,
    );
  }

  const { data, error } = await ctx.supabase
    .from('tenancies')
    .update({
      status: 'ended',
      end_date: input.end_date,
      end_reason: input.reason,
      ended_at: new Date().toISOString(),
      notes: input.notes ?? null,
    })
    .eq('id', tenancyId)
    .select('*')
    .single();

  if (error || !data) throw new DbError(error ?? 'no row returned');

  if (existing.room_id) {
    const { error: roomErr } = await ctx.supabase
      .from('rooms')
      .update({ status: 'available' })
      .eq('id', existing.room_id)
      .neq('status', 'archived');
    if (roomErr) {
      ctx.log.warn({ err: roomErr }, 'could not free room after tenancy end (non-fatal)');
    }
  }

  return Tenancy.parse(data);
}
