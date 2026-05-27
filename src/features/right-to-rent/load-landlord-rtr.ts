import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type RtrDocumentType =
  | 'british_passport'
  | 'brp_card'
  | 'share_code'
  | 'eu_settlement'
  | 'other';

export type RtrStatus = 'verified' | 'recheck_due' | 'recheck_overdue' | 'unverified';

export type RtrRow = {
  tenancyId: string;
  tenantName: string;
  tenantInitials: string;
  tenantColour: string;
  propertyName: string;
  roomName: string | null;
  documentType: RtrDocumentType | null;
  shareCode: string | null;
  checkedAt: string | null;
  expiresAt: string | null;
  evidenceDocumentId: string | null;
  status: RtrStatus;
};

export type LandlordRtrData = {
  rows: RtrRow[];
  kpis: {
    total: number;
    verified: number;
    recheckDue: number;
    recheckOverdue: number;
  };
  recheckBanner: RtrRow | null;
};

const AV_COLOURS = ['#0F6E56', '#D85A30', '#1D9E75', '#534AB7', '#3B6D11', '#185FA5', '#BA7517'];

const RECHECK_WARNING_DAYS = 60;

type TenancyRtrRow = {
  id: string;
  tenant_user_id: string | null;
  invite_email: string | null;
  rtr_check_completed_at: string | null;
  rtr_document_type: RtrDocumentType | null;
  rtr_share_code: string | null;
  rtr_expires_at: string | null;
  rtr_evidence_document_id: string | null;
  properties: { id: string; name: string } | { id: string; name: string }[] | null;
  rooms: { id: string; name: string } | { id: string; name: string }[] | null;
};

function firstOf<T>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function colourFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AV_COLOURS[hash % AV_COLOURS.length] ?? AV_COLOURS[0] ?? '#0F6E56';
}

export async function loadLandlordRtr(
  supabase: SupabaseClient,
  orgId: string,
): Promise<LandlordRtrData> {
  const { data, error } = await supabase
    .from('tenancies')
    .select(
      `id, tenant_user_id, invite_email,
       rtr_check_completed_at, rtr_document_type, rtr_share_code, rtr_expires_at,
       rtr_evidence_document_id,
       properties:property_id (id, name),
       rooms:room_id (id, name)`,
    )
    .eq('org_id', orgId)
    // 'ending_soon' is a derived UI bucket, not a tenancy_status enum
    // value — filter on the real DB states only.
    .in('status', ['pending_invite', 'awaiting_signature', 'awaiting_deposit', 'active'])
    .order('rtr_expires_at', { ascending: true, nullsFirst: false });

  if (error) throw error;
  const raw = (data ?? []) as TenancyRtrRow[];

  const tenantIds = Array.from(
    new Set(raw.map((r) => r.tenant_user_id).filter((id): id is string => Boolean(id))),
  );
  const profiles = new Map<string, { full_name: string | null; contact_email: string | null }>();
  if (tenantIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, contact_email')
      .in('id', tenantIds);
    for (const p of profileRows ?? []) {
      profiles.set(p.id, p);
    }
  }

  const today = new Date();
  const warning = new Date(Date.now() + RECHECK_WARNING_DAYS * 86_400_000);

  const rows: RtrRow[] = raw.map((r) => {
    const profile = r.tenant_user_id ? profiles.get(r.tenant_user_id) : undefined;
    const name = profile?.full_name ?? profile?.contact_email ?? r.invite_email ?? 'Tenant';
    const property = firstOf<{ id: string; name: string }>(r.properties);
    const room = firstOf<{ id: string; name: string }>(r.rooms);

    let status: RtrStatus = 'unverified';
    if (r.rtr_check_completed_at) {
      status = 'verified';
      if (r.rtr_expires_at) {
        const expires = new Date(`${r.rtr_expires_at}T00:00:00Z`);
        if (expires < today) status = 'recheck_overdue';
        else if (expires < warning) status = 'recheck_due';
      }
    }

    return {
      tenancyId: r.id,
      tenantName: name,
      tenantInitials: initials(name) || 'TN',
      tenantColour: colourFor(name),
      propertyName: property?.name ?? '—',
      roomName: room?.name ?? null,
      documentType: r.rtr_document_type,
      shareCode: r.rtr_share_code,
      checkedAt: r.rtr_check_completed_at,
      expiresAt: r.rtr_expires_at,
      evidenceDocumentId: r.rtr_evidence_document_id,
      status,
    };
  });

  const recheckDue = rows.filter((r) => r.status === 'recheck_due');
  const recheckOverdue = rows.filter((r) => r.status === 'recheck_overdue');
  const banner = [...recheckOverdue, ...recheckDue][0] ?? null;

  return {
    rows,
    kpis: {
      total: rows.length,
      verified: rows.filter((r) => r.status === 'verified').length,
      recheckDue: recheckDue.length,
      recheckOverdue: recheckOverdue.length,
    },
    recheckBanner: banner,
  };
}
