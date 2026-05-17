import 'server-only';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Delete a bill and all of its allocations (cascade).
 *
 * Landlord-side only. RLS already restricts to org members with
 * `owner|agent|staff`; we just look the row up first to throw a
 * tidy 404 instead of leaking a "0 rows updated".
 */
export async function deleteBill(ctx: HandlerContext, billId: string): Promise<void> {
  requireUser(ctx);

  const { data: bill, error: lookupErr } = await ctx.supabase
    .from('bills')
    .select('id')
    .eq('id', billId)
    .maybeSingle();
  if (lookupErr) throw new DbError(lookupErr);
  if (!bill) throw new AppError(404, ErrorCode.not_found, 'Bill not found');

  const { error: deleteErr } = await ctx.supabase.from('bills').delete().eq('id', billId);
  if (deleteErr) throw new DbError(deleteErr);
}
