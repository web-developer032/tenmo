import 'server-only';
import { ComplianceItem, type ComplianceItemUpdate } from '@/core/schemas/compliance';
import { derivedExpiresAt } from '@/core/utils/compliance-rules';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Update a compliance item. If `issued_at` is supplied without `expires_at`
 * and the type has a fixed validity, expiry is recomputed.
 */
export async function updateComplianceItem(
  ctx: HandlerContext,
  itemId: string,
  input: ComplianceItemUpdate,
): Promise<ReturnType<typeof ComplianceItem.parse>> {
  const { data: existing, error: loadErr } = await ctx.supabase
    .from('compliance_items')
    .select('id, type, issued_at, expires_at')
    .eq('id', itemId)
    .maybeSingle();

  if (loadErr) throw new DbError(loadErr);
  if (!existing) throw new NotFoundError('Compliance item not found');

  const nextIssuedAt = input.issued_at !== undefined ? input.issued_at : existing.issued_at;
  let nextExpiresAt: string | null | undefined = input.expires_at;
  if (nextExpiresAt === undefined) {
    if (input.issued_at !== undefined && input.issued_at !== existing.issued_at) {
      nextExpiresAt = derivedExpiresAt(existing.type, input.issued_at) ?? existing.expires_at;
    }
  }

  if (nextIssuedAt && nextExpiresAt && nextExpiresAt < nextIssuedAt) {
    throw new BusinessRuleError('Expiry date cannot be before the issue date');
  }

  const patch: Record<string, unknown> = {};
  if (input.issued_at !== undefined) patch.issued_at = input.issued_at;
  if (nextExpiresAt !== undefined) patch.expires_at = nextExpiresAt;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.document_path !== undefined) patch.document_path = input.document_path;

  const { data, error } = await ctx.supabase
    .from('compliance_items')
    .update(patch)
    .eq('id', itemId)
    .select('*')
    .single();

  if (error) throw new DbError(error);
  return ComplianceItem.parse(data);
}
