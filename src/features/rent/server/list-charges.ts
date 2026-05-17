import 'server-only';
import { RentCharge, type RentChargeListFilter } from '@/core/schemas/rent';
import type { HandlerContext } from '@/lib/handler';

export type RentChargeRow = ReturnType<typeof RentCharge.parse>;

/**
 * List rent charges visible to the caller. RLS enforces:
 *   - org members see all charges in their org
 *   - tenants see only their own tenancy's charges
 * Filters are best-effort hints for query efficiency.
 */
export async function listRentCharges(
  ctx: HandlerContext,
  filter: RentChargeListFilter & { org_id?: string },
): Promise<RentChargeRow[]> {
  let query = ctx.supabase
    .from('rent_charges')
    .select('*')
    .order('due_date', { ascending: false })
    .order('period_start', { ascending: false });

  if (filter.org_id) query = query.eq('org_id', filter.org_id);
  if (filter.tenancy_id) query = query.eq('tenancy_id', filter.tenancy_id);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.from) query = query.gte('due_date', filter.from);
  if (filter.to) query = query.lte('due_date', filter.to);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => RentCharge.parse(row));
}

/** Load a single rent charge — null when not visible to caller. */
export async function loadRentCharge(
  ctx: HandlerContext,
  chargeId: string,
): Promise<RentChargeRow | null> {
  const { data, error } = await ctx.supabase
    .from('rent_charges')
    .select('*')
    .eq('id', chargeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return RentCharge.parse(data);
}
