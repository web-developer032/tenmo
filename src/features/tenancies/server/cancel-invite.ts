import { Tenancy } from '@/core/schemas/tenancy';
import { BusinessRuleError, DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Cancel a pending invite. Calls the SECURITY INVOKER RPC so RLS does the
 * permission check; if the row isn't pending or the caller lacks permission,
 * Postgres raises 42501 which we surface as a BusinessRuleError.
 */
export async function cancelTenancyInvite(
  ctx: HandlerContext,
  tenancyId: string,
): Promise<ReturnType<typeof Tenancy.parse>> {
  const { data, error } = await ctx.supabase.rpc('cancel_tenancy_invite', {
    p_tenancy_id: tenancyId,
  });
  if (error) {
    if (error.code === '42501') {
      throw new BusinessRuleError(
        'Invite is not pending or you do not have permission to cancel it',
      );
    }
    throw new DbError(error);
  }
  return Tenancy.parse(data);
}
