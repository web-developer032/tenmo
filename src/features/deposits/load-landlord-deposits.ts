import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type DepositRow = {
  tenancyId: string;
  tenantName: string;
  tenantInitials: string;
  tenantColour: string;
  propertyName: string;
  roomName: string | null;
  depositPence: number;
  scheme: 'dps' | 'mydeposits' | 'tds' | null;
  reference: string | null;
  protectedAt: string | null;
  prescribedInfoSentAt: string | null;
  endDate: string | null;
  status: 'protected' | 'unprotected' | 'late' | 'returning' | 'ended';
};

export type LandlordDepositsData = {
  rows: DepositRow[];
  kpis: {
    totalDepositsPence: number;
    protectedCount: number;
    unprotectedCount: number;
    prescribedInfoSent: number;
  };
};

type TenancyDepositRow = {
  id: string;
  tenant_user_id: string | null;
  invite_email: string | null;
  status: string;
  deposit_pence: number;
  deposit_scheme: 'dps' | 'mydeposits' | 'tds' | null;
  deposit_reference: string | null;
  deposit_protected_at: string | null;
  prescribed_information_sent_at: string | null;
  end_date: string | null;
  properties: { id: string; name: string } | { id: string; name: string }[] | null;
  rooms: { id: string; name: string } | { id: string; name: string }[] | null;
};

const AV_COLOURS = ['#0F6E56', '#D85A30', '#1D9E75', '#534AB7', '#3B6D11', '#185FA5'];

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

/**
 * Loads every active tenancy's deposit row for the deposits register.
 *
 * "Active" here covers anything the landlord is still on the hook for —
 * `awaiting_deposit / awaiting_signature / pending_invite / active /
 * ending_soon`. Ended tenancies are excluded (they get their own
 * archive page later).
 */
export async function loadLandlordDeposits(
  supabase: SupabaseClient,
  orgId: string,
): Promise<LandlordDepositsData> {
  const { data, error } = await supabase
    .from('tenancies')
    .select(
      `id, tenant_user_id, invite_email, status,
       deposit_pence, deposit_scheme, deposit_reference, deposit_protected_at,
       prescribed_information_sent_at, end_date,
       properties:property_id (id, name),
       rooms:room_id (id, name)`,
    )
    .eq('org_id', orgId)
    // 'ending_soon' is a derived UI bucket (active tenancy with end_date
    // within 60 days), computed below from `endingThresholdIso`. It is
    // NOT a tenancy_status enum value, so do not put it in this filter.
    .in('status', ['pending_invite', 'awaiting_signature', 'awaiting_deposit', 'active'])
    .order('deposit_protected_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  const raw = (data ?? []) as TenancyDepositRow[];

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

  const today = new Date().toISOString().slice(0, 10);
  const endingThresholdIso = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

  const rows: DepositRow[] = raw.map((r) => {
    const profile = r.tenant_user_id ? profiles.get(r.tenant_user_id) : undefined;
    const name = profile?.full_name ?? profile?.contact_email ?? r.invite_email ?? 'Tenant';
    const property = firstOf<{ id: string; name: string }>(r.properties);
    const room = firstOf<{ id: string; name: string }>(r.rooms);

    let status: DepositRow['status'] = 'unprotected';
    if (r.deposit_protected_at) {
      status = 'protected';
      if (r.end_date && r.end_date <= endingThresholdIso && r.end_date >= today) {
        status = 'returning';
      }
    } else if (r.deposit_pence > 0) {
      const created = r.deposit_protected_at ?? null;
      if (!created) status = 'unprotected';
    }

    return {
      tenancyId: r.id,
      tenantName: name,
      tenantInitials: initials(name) || 'TN',
      tenantColour: colourFor(name),
      propertyName: property?.name ?? '—',
      roomName: room?.name ?? null,
      depositPence: r.deposit_pence,
      scheme: r.deposit_scheme,
      reference: r.deposit_reference,
      protectedAt: r.deposit_protected_at,
      prescribedInfoSentAt: r.prescribed_information_sent_at,
      endDate: r.end_date,
      status,
    };
  });

  const totalDepositsPence = rows.reduce((sum, r) => sum + r.depositPence, 0);
  const protectedCount = rows.filter((r) => r.protectedAt !== null).length;
  const unprotectedCount = rows.filter((r) => r.protectedAt === null && r.depositPence > 0).length;
  const prescribedInfoSent = rows.filter((r) => r.prescribedInfoSentAt !== null).length;

  return {
    rows,
    kpis: {
      totalDepositsPence,
      protectedCount,
      unprotectedCount,
      prescribedInfoSent,
    },
  };
}
