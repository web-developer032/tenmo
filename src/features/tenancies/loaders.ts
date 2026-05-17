import 'server-only';
import { Tenancy } from '@/core/schemas/tenancy';
import { createClient } from '@/lib/supabase/server';

export type TenancyRowWithRelations = ReturnType<typeof Tenancy.parse> & {
  property_name: string | null;
  property_city: string | null;
  room_name: string | null;
  tenant_email: string | null;
};

/**
 * Load all tenancies for a given org with the relations needed by the
 * landlord list/detail pages. Authoritatively scoped via RLS.
 */
export async function loadOrgTenancies(orgId: string): Promise<TenancyRowWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tenancies')
    .select(`*, properties:property_id (name, address), rooms:room_id (name)`)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const property = pickFirst<{
      name: string;
      address: { city?: string | null } | null;
    }>(row.properties);
    const room = pickFirst<{ name: string }>(row.rooms);
    const tenancy = Tenancy.parse(row);
    return {
      ...tenancy,
      property_name: property?.name ?? null,
      property_city: property?.address?.city ?? null,
      room_name: room?.name ?? null,
      tenant_email: tenancy.invite_email,
    };
  });
}

/** Load a single tenancy + relations. */
export async function loadTenancy(tenancyId: string): Promise<TenancyRowWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tenancies')
    .select(`*, properties:property_id (name, address), rooms:room_id (name)`)
    .eq('id', tenancyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const property = pickFirst<{
    name: string;
    address: { city?: string | null } | null;
  }>(data.properties);
  const room = pickFirst<{ name: string }>(data.rooms);
  const tenancy = Tenancy.parse(data);
  return {
    ...tenancy,
    property_name: property?.name ?? null,
    property_city: property?.address?.city ?? null,
    room_name: room?.name ?? null,
    tenant_email: tenancy.invite_email,
  };
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
