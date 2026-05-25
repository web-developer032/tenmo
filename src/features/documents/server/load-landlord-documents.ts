import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentCategory, DocumentKind } from '@/core/constants/documents';

export type LandlordDocumentRow = {
  id: string;
  filename: string;
  title: string | null;
  kind: DocumentKind;
  category: DocumentCategory;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  property_id: string | null;
  property_name: string | null;
  room_id: string | null;
  room_name: string | null;
  tenancy_id: string | null;
  tenant_name: string | null;
};

export type LandlordDocumentsData = {
  rows: LandlordDocumentRow[];
  counts: {
    all: number;
    compliance: number;
    tenancy: number;
    inventory: number;
    rtr: number;
    other: number;
  };
  totalBytes: number;
};

type ProfileMini = { id: string; full_name: string | null; contact_email: string | null };

function firstOf<T>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}

/**
 * Aggregates the org's documents with parent property/room/tenancy context
 * so the vault page can render a flat table without N+1 lookups.
 *
 * Right to Rent docs are identified by category=`identity` to match the
 * RtR feature; inventories use category=`inventory`.
 */
export async function loadLandlordDocuments(
  supabase: SupabaseClient,
  orgId: string,
): Promise<LandlordDocumentsData> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      `id, filename, title, kind, category, size_bytes, mime_type, created_at,
       property_id, room_id, tenancy_id,
       properties:property_id (id, name),
       rooms:room_id (id, name),
       tenancies:tenancy_id (id, tenant_user_id, invite_email)`,
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  const raw = data ?? [];

  const tenantUserIds = Array.from(
    new Set(
      raw
        .map((r) => firstOf<{ tenant_user_id: string | null }>(r.tenancies)?.tenant_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profiles = new Map<string, ProfileMini>();
  if (tenantUserIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, contact_email')
      .in('id', tenantUserIds);
    for (const p of profileRows ?? []) {
      profiles.set(p.id, p as ProfileMini);
    }
  }

  const rows: LandlordDocumentRow[] = raw.map((r) => {
    const property = firstOf<{ id: string; name: string }>(r.properties);
    const room = firstOf<{ id: string; name: string }>(r.rooms);
    const tenancy = firstOf<{
      id: string;
      tenant_user_id: string | null;
      invite_email: string | null;
    }>(r.tenancies);
    const profile = tenancy?.tenant_user_id ? profiles.get(tenancy.tenant_user_id) : undefined;

    return {
      id: r.id,
      filename: r.filename,
      title: r.title ?? null,
      kind: r.kind as DocumentKind,
      category: r.category as DocumentCategory,
      size_bytes: r.size_bytes,
      mime_type: r.mime_type,
      created_at: r.created_at,
      property_id: property?.id ?? null,
      property_name: property?.name ?? null,
      room_id: room?.id ?? null,
      room_name: room?.name ?? null,
      tenancy_id: tenancy?.id ?? null,
      tenant_name: profile?.full_name ?? profile?.contact_email ?? tenancy?.invite_email ?? null,
    };
  });

  const counts = {
    all: rows.length,
    compliance: rows.filter((r) => r.kind === 'compliance' || r.category === 'certificate').length,
    tenancy: rows.filter((r) => r.category === 'ast' || r.category === 'prescribed_information')
      .length,
    inventory: rows.filter((r) => r.category === 'inventory').length,
    rtr: rows.filter((r) => r.category === 'identity').length,
    other: rows.filter(
      (r) =>
        !['certificate', 'ast', 'prescribed_information', 'inventory', 'identity'].includes(
          r.category,
        ),
    ).length,
  };

  const totalBytes = rows.reduce((sum, r) => sum + r.size_bytes, 0);
  return { rows, counts, totalBytes };
}
