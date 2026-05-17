import 'server-only';
import { Bill, BillAllocation } from '@/core/schemas/bills';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

export interface BillWithAllocations {
  bill: Bill;
  allocations: BillAllocation[];
}

export async function getBill(ctx: HandlerContext, billId: string): Promise<BillWithAllocations> {
  requireUser(ctx);

  const { data: bill, error } = await ctx.supabase
    .from('bills')
    .select('*')
    .eq('id', billId)
    .maybeSingle();
  if (error) throw new DbError(error);
  if (!bill) throw new AppError(404, ErrorCode.not_found, 'Bill not found');

  const { data: allocations, error: aErr } = await ctx.supabase
    .from('bill_allocations')
    .select('*')
    .eq('bill_id', billId);
  if (aErr) throw new DbError(aErr);

  return {
    bill: Bill.parse(bill),
    allocations: (allocations ?? []).map((a) => BillAllocation.parse(a)),
  };
}

export async function listBillsForProperty(
  ctx: HandlerContext,
  propertyId: string,
): Promise<Bill[]> {
  requireUser(ctx);
  const { data, error } = await ctx.supabase
    .from('bills')
    .select('*')
    .eq('property_id', propertyId)
    .order('period_start', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new DbError(error);
  return (data ?? []).map((b) => Bill.parse(b));
}
