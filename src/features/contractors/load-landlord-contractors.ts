import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ContractorTrade =
  | 'plumbing'
  | 'electrical'
  | 'gas'
  | 'general'
  | 'security'
  | 'heating'
  | 'locksmith'
  | 'roofing'
  | 'cleaning';

export type ContractorRow = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  trades: ContractorTrade[];
  coverageAreas: string[];
  dayRatePence: number | null;
  gasSafeNumber: string | null;
  niceicNumber: string | null;
  lastUsedAt: string | null;
  rating: number | null;
  notes: string | null;
};

export type LandlordContractorsData = {
  rows: ContractorRow[];
  counts: Record<ContractorTrade | 'all', number>;
};

/**
 * Loads the org's contractor directory and pre-counts each trade for the
 * tab bar on `/contractors`. We sort by `last_used_at` so the contractor
 * the landlord touched most recently shows up first.
 */
export async function loadLandlordContractors(
  supabase: SupabaseClient,
  orgId: string,
): Promise<LandlordContractorsData> {
  const { data, error } = await supabase
    .from('contractors')
    .select(
      `id, name, contact_name, phone, email, trades, coverage_areas, day_rate_pence,
       gas_safe_number, niceic_number, last_used_at, rating, notes, archived_at`,
    )
    .eq('org_id', orgId)
    .is('archived_at', null)
    .order('last_used_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  const rows: ContractorRow[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    contactName: r.contact_name,
    phone: r.phone,
    email: r.email,
    trades: (r.trades ?? []) as ContractorTrade[],
    coverageAreas: (r.coverage_areas ?? []) as string[],
    dayRatePence: r.day_rate_pence,
    gasSafeNumber: r.gas_safe_number,
    niceicNumber: r.niceic_number,
    lastUsedAt: r.last_used_at,
    rating: r.rating,
    notes: r.notes,
  }));

  const counts: Record<ContractorTrade | 'all', number> = {
    all: rows.length,
    plumbing: 0,
    electrical: 0,
    gas: 0,
    general: 0,
    security: 0,
    heating: 0,
    locksmith: 0,
    roofing: 0,
    cleaning: 0,
  };
  for (const r of rows) {
    for (const t of r.trades) counts[t] += 1;
  }

  return { rows, counts };
}
