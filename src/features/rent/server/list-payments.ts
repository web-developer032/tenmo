import 'server-only';
import { RentPayment } from '@/core/schemas/rent';
import type { HandlerContext } from '@/lib/handler';

export type RentPaymentRow = ReturnType<typeof RentPayment.parse>;

export type ListRentPaymentsFilter = {
  org_id?: string;
  tenancy_id?: string;
  charge_id?: string;
  status?: 'pending' | 'confirmed' | 'failed' | 'charged_back' | 'refunded';
};

/** List rent payments visible to the caller. RLS enforces visibility. */
export async function listRentPayments(
  ctx: HandlerContext,
  filter: ListRentPaymentsFilter,
): Promise<RentPaymentRow[]> {
  let query = ctx.supabase
    .from('rent_payments')
    .select('*')
    .order('paid_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (filter.org_id) query = query.eq('org_id', filter.org_id);
  if (filter.tenancy_id) query = query.eq('tenancy_id', filter.tenancy_id);
  if (filter.charge_id) query = query.eq('charge_id', filter.charge_id);
  if (filter.status) query = query.eq('status', filter.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => RentPayment.parse(row));
}
