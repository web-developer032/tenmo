import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type LandlordStats = {
  propertiesCount: number;
  roomsCount: number;
  occupiedRoomsCount: number;
  activeTenanciesCount: number;
  complianceRedCount: number;
  complianceAmberCount: number;
};

/**
 * Aggregate dashboard stats for an org. RLS scopes everything to rows the user
 * can see — agents/staff with restricted membership get a smaller picture.
 */
export async function loadLandlordStats(orgId: string): Promise<LandlordStats> {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const inThirty = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [properties, rooms, tenancies, complianceRed, complianceAmber] = await Promise.all([
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('rooms').select('id, status', { count: 'exact' }).eq('org_id', orgId),
    supabase
      .from('tenancies')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active'),
    supabase
      .from('compliance_items')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .lt('expires_at', today),
    supabase
      .from('compliance_items')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('expires_at', today)
      .lte('expires_at', inThirty),
  ]);

  const occupied = rooms.data?.filter((r) => r.status === 'occupied').length ?? 0;

  return {
    propertiesCount: properties.count ?? 0,
    roomsCount: rooms.count ?? 0,
    occupiedRoomsCount: occupied,
    activeTenanciesCount: tenancies.count ?? 0,
    complianceRedCount: complianceRed.count ?? 0,
    complianceAmberCount: complianceAmber.count ?? 0,
  };
}
