import 'server-only';
import { ComplianceItem, type ComplianceItemCreate } from '@/core/schemas/compliance';
import { derivedExpiresAt } from '@/core/utils/compliance-rules';
import { BusinessRuleError, DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

export type CreateComplianceItemResult = {
  item: ReturnType<typeof ComplianceItem.parse>;
};

/**
 * Persist a new compliance item.
 *
 * Behaviour:
 *  - If the input has `issued_at` but no `expires_at` and the type has a
 *    fixed validity period, derive `expires_at` automatically.
 *  - The DB enforces RLS (landlord-roles only) and the scope CHECK
 *    (property/room/tenancy must be set).
 */
export async function createComplianceItem(
  ctx: HandlerContext,
  orgId: string,
  input: ComplianceItemCreate,
  user: { id: string },
): Promise<CreateComplianceItemResult> {
  if (input.expires_at && input.issued_at && input.expires_at < input.issued_at) {
    throw new BusinessRuleError('Expiry date cannot be before the issue date');
  }

  const expiresAt = input.expires_at ?? derivedExpiresAt(input.type, input.issued_at);

  const { data, error } = await ctx.supabase
    .from('compliance_items')
    .insert({
      org_id: orgId,
      property_id: input.property_id ?? null,
      room_id: input.room_id ?? null,
      tenancy_id: input.tenancy_id ?? null,
      type: input.type,
      issued_at: input.issued_at ?? null,
      expires_at: expiresAt,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) throw new DbError(error);
  return { item: ComplianceItem.parse(data) };
}
