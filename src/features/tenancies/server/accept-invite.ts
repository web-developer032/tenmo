import { Tenancy, TenancyInvitePreview } from '@/core/schemas/tenancy';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Public preview — does not require auth. Calls a SECURITY DEFINER SQL
 * function that returns a redacted view of the pending invite.
 */
export async function previewInvite(
  ctx: HandlerContext,
  token: string,
): Promise<ReturnType<typeof TenancyInvitePreview.parse>> {
  const { data, error } = await ctx.supabase
    .rpc('preview_tenancy_invite', { p_token: token })
    .maybeSingle();

  if (error) throw new DbError(error);
  if (!data) throw new NotFoundError('Invite not found, already used, or expired');

  return TenancyInvitePreview.parse(data);
}

/**
 * Authenticated tenant accepts an invite. The DB function validates the
 * email match and expiry; we translate its raised SQL states into AppErrors.
 */
export async function acceptInvite(
  ctx: HandlerContext,
  token: string,
): Promise<ReturnType<typeof Tenancy.parse>> {
  const { data, error } = await ctx.supabase.rpc('accept_tenancy_invite', { p_token: token });

  if (error) {
    switch (error.code) {
      case '42501':
        throw new BusinessRuleError(
          'This invite was issued to a different email — sign in with the address it was sent to',
        );
      case 'P0002':
        throw new NotFoundError('Invite not found');
      case '22023':
        throw new BusinessRuleError('Invite has expired or is no longer pending');
      default:
        throw new DbError(error);
    }
  }
  return Tenancy.parse(data);
}
