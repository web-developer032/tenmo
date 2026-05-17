import 'server-only';
import { DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Hard-delete a compliance item. Audit trail relies on `compliance_reminders`
 * being cascade-deleted with the parent.
 */
export async function deleteComplianceItem(ctx: HandlerContext, itemId: string): Promise<void> {
  const { error, count } = await ctx.supabase
    .from('compliance_items')
    .delete({ count: 'exact' })
    .eq('id', itemId);

  if (error) throw new DbError(error);
  if (!count) throw new NotFoundError('Compliance item not found');
}
