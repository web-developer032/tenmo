import 'server-only';
import type { BillAllocationMethod, BillType } from '@/core/constants/bills';
import { Bill, BillAllocation } from '@/core/schemas/bills';
import { createClient } from '@/lib/supabase/server';

/**
 * Server loaders for the bills domain. RSC-friendly — never imports
 * `next/navigation` or React.
 *
 * RLS handles authorisation: org members see all of their org's
 * bills + allocations, tenants see only their own room's
 * allocations. We don't add app-level filtering.
 */

export interface BillWithAllocations {
  bill: Bill;
  allocations: BillAllocation[];
}

export async function loadBillsForProperty(propertyId: string): Promise<BillWithAllocations[]> {
  const sb = await createClient();
  const { data: bills, error } = await sb
    .from('bills')
    .select('*')
    .eq('property_id', propertyId)
    .order('period_start', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!bills || bills.length === 0) return [];

  const billIds = bills.map((b) => b.id);
  const { data: allocations, error: aErr } = await sb
    .from('bill_allocations')
    .select('*')
    .in('bill_id', billIds);
  if (aErr) throw aErr;

  const allocByBill = new Map<string, BillAllocation[]>();
  for (const a of allocations ?? []) {
    const parsed = BillAllocation.parse(a);
    const list = allocByBill.get(parsed.bill_id) ?? [];
    list.push(parsed);
    allocByBill.set(parsed.bill_id, list);
  }

  return bills.map((b) => ({
    bill: Bill.parse(b),
    allocations: allocByBill.get(b.id) ?? [],
  }));
}

export interface TenantBillRow {
  bill_id: string;
  bill_type: BillType;
  provider: string | null;
  period_start: string;
  period_end: string;
  allocation_method: BillAllocationMethod;
  total_pence: number;
  amount_pence: number;
  share_basis_points: number | null;
  bill_notes: string | null;
}

export async function loadBillsForTenancy(tenancyId: string): Promise<TenantBillRow[]> {
  const sb = await createClient();
  const { data, error } = await sb.rpc('bills_for_tenancy', { p_tenancy_id: tenancyId });
  if (error) throw error;
  return (data ?? []) as TenantBillRow[];
}
