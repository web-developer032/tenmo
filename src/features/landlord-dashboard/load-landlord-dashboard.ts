import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side loader for /landlord/[slug] dashboard.
 *
 * Returns the four KPI scalars + a normalised set of lists for the rent
 * status table, the alerts panel, portfolio mini-stats and the three
 * snapshot cards (Properties / Maintenance / Compliance). All queries are
 * org-scoped and run in parallel; RLS keeps non-members out at the row
 * level (the org_id filter is belt-and-braces).
 */

const ALERT_AMBER_THRESHOLD_DAYS = 30;
const ENDING_SOON_DAYS = 60;

const PROPERTY_THUMBS = [
  { bg: 'bg-foam', stroke: '#0F6E56', fill: '#1D9E75', accent: '#9FE1CB' },
  { bg: 'bg-forest-100', stroke: '#3B6D11', fill: '#3B6D11', accent: '#97C459' },
  { bg: 'bg-blue-bg', stroke: '#185FA5', fill: '#185FA5', accent: '#85B7EB' },
  { bg: 'bg-purple-bg', stroke: '#5B3A8C', fill: '#5B3A8C', accent: '#C2A3E8' },
  { bg: 'bg-amber-bg', stroke: '#BA7517', fill: '#BA7517', accent: '#F2C58E' },
  { bg: 'bg-alert-bg', stroke: '#D85A30', fill: '#D85A30', accent: '#F2A98C' },
];

export type RentRow = {
  id: string;
  tenantName: string;
  tenantSince: string | null;
  propertyName: string;
  roomName: string | null;
  amountPence: number;
  dueDate: string;
  status: 'paid' | 'due' | 'overdue' | 'upcoming' | 'partial' | 'cancelled' | 'pending';
  daysFromDue: number;
};

export type DashboardAlert = {
  id: string;
  kind: 'rent' | 'ticket' | 'compliance' | 'tenancy';
  title: string;
  meta: string;
  badge: { label: string; tone: 'alert' | 'amber' | 'blue' | 'forest' };
  href: string;
};

export type DashboardPropertyRow = {
  id: string;
  name: string;
  city: string | null;
  postcode: string | null;
  rooms: number;
  occupiedRooms: number;
  monthlyRentPence: number;
  thumb: (typeof PROPERTY_THUMBS)[number];
};

export type DashboardMaintenanceRow = {
  id: string;
  title: string;
  property: string;
  ago: string;
  reporter: string | null;
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';
};

export type DashboardComplianceRow = {
  id: string;
  title: string;
  property: string;
  meta: string;
  status: 'ok' | 'due_soon' | 'overdue' | 'unknown';
  daysRemaining: number | null;
};

export type LandlordDashboard = {
  greetingName: string;
  monthLabel: string;
  todayLabel: string;
  kpis: {
    rentCollectedPence: number;
    rentCollectedDeltaPence: number;
    occupiedRooms: number;
    totalRooms: number;
    openTickets: number;
    openUrgent: number;
    complianceValid: number;
    complianceTotal: number;
    complianceAmber: number;
  };
  portfolio: {
    propertiesCount: number;
    tenantsCount: number;
    occupancyRate: number;
    rentCollectedPence: number;
    rentOutstandingPence: number;
  };
  rentRows: RentRow[];
  rentOverdueCount: number;
  alerts: DashboardAlert[];
  properties: DashboardPropertyRow[];
  maintenance: DashboardMaintenanceRow[];
  compliance: DashboardComplianceRow[];
};

type LoadOpts = {
  orgId: string;
  userId: string;
  now?: Date;
  timezone?: string;
};

export async function loadLandlordDashboard(
  supabase: SupabaseClient,
  opts: LoadOpts,
): Promise<LandlordDashboard> {
  const now = opts.now ?? new Date();
  const today = formatISODate(now);
  const periodStart = formatISODate(startOfMonth(now));
  const periodEnd = formatISODate(endOfMonth(now));
  const amberDate = formatISODate(addDays(now, ALERT_AMBER_THRESHOLD_DAYS));
  const endingSoonDate = formatISODate(addDays(now, ENDING_SOON_DAYS));

  const [
    profileResp,
    propertiesResp,
    roomsResp,
    activeTenanciesResp,
    rentChargesResp,
    ticketsResp,
    complianceResp,
    tenancyEndingsResp,
    lastMonthChargesResp,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, preferred_name, timezone')
      .eq('id', opts.userId)
      .maybeSingle(),
    supabase
      .from('properties')
      .select('id, name, address')
      .eq('org_id', opts.orgId)
      .is('archived_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('rooms')
      .select('id, name, property_id, status')
      .eq('org_id', opts.orgId)
      .is('archived_at', null),
    supabase
      .from('tenancies')
      .select(
        'id, property_id, room_id, rent_pence, start_date, end_date, tenant_user_id, profiles:tenant_user_id(full_name, contact_email)',
      )
      .eq('org_id', opts.orgId)
      .eq('status', 'active'),
    supabase
      .from('rent_charges')
      .select(
        'id, tenancy_id, amount_pence, paid_pence, due_date, period_start, status, tenancies!inner(property_id, room_id, tenant_user_id, start_date, profiles:tenant_user_id(full_name))',
      )
      .eq('org_id', opts.orgId)
      .gte('period_start', periodStart)
      .lte('period_start', periodEnd)
      .order('due_date', { ascending: true }),
    supabase
      .from('tickets')
      .select(
        'id, title, status, severity, property_id, created_at, created_by, profiles:created_by(full_name)',
      )
      .eq('org_id', opts.orgId)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('compliance_items')
      .select('id, type, property_id, status, expires_at')
      .eq('org_id', opts.orgId)
      .order('expires_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('tenancies')
      .select('id, property_id, room_id, end_date, profiles:tenant_user_id(full_name)')
      .eq('org_id', opts.orgId)
      .eq('status', 'active')
      .not('end_date', 'is', null)
      .lte('end_date', endingSoonDate)
      .order('end_date', { ascending: true })
      .limit(3),
    supabase
      .from('rent_charges')
      .select('amount_pence, paid_pence')
      .eq('org_id', opts.orgId)
      .gte('period_start', formatISODate(startOfMonth(addDays(now, -32))))
      .lt('period_start', periodStart),
  ]);

  const profile = profileResp.data;
  const properties = propertiesResp.data ?? [];
  const rooms = roomsResp.data ?? [];
  const activeTenancies = activeTenanciesResp.data ?? [];
  const rentCharges = rentChargesResp.data ?? [];
  const tickets = ticketsResp.data ?? [];
  const compliance = complianceResp.data ?? [];
  const tenancyEndings = tenancyEndingsResp.data ?? [];
  const lastMonthCharges = lastMonthChargesResp.data ?? [];

  const greetingName =
    (profile?.preferred_name as string | null) ??
    ((profile?.full_name as string | null) ?? '').split(/\s+/)[0] ??
    'there';

  const monthLabel = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const todayLabel = now.toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ---- KPI scalars ------------------------------------------------------
  const rentCollectedPence = sumBy(rentCharges, (c) => c.paid_pence ?? 0);
  const lastMonthCollected = sumBy(lastMonthCharges, (c) => c.paid_pence ?? 0);
  const rentCollectedDeltaPence = rentCollectedPence - lastMonthCollected;
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length;
  const openUrgent = tickets.filter((t) => t.severity === 'high' && t.status === 'open').length;
  const complianceTotal = compliance.length;
  const complianceValid = compliance.filter((c) => c.status === 'ok').length;
  const complianceAmber = compliance.filter((c) => c.status === 'due_soon').length;

  // ---- Rent rows for the table -----------------------------------------
  type TenancyJoin = {
    property_id: string;
    room_id: string | null;
    start_date: string | null;
    profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
  };
  const rentRows: RentRow[] = rentCharges
    .map((c): RentRow => {
      const raw = (c as unknown as { tenancies?: TenancyJoin | TenancyJoin[] | null }).tenancies;
      const tenancy = Array.isArray(raw) ? raw[0] : raw;
      const propertyName =
        properties.find((p) => p.id === tenancy?.property_id)?.name ?? 'Property';
      const roomName = rooms.find((r) => r.id === tenancy?.room_id)?.name ?? null;
      const profileRaw = tenancy?.profiles;
      const profileObj = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
      const tenantName = profileObj?.full_name ?? 'Pending tenant';
      const daysFromDue = daysBetween(today, c.due_date as string);
      return {
        id: c.id as string,
        tenantName,
        tenantSince: tenancy?.start_date ? formatSince(tenancy.start_date) : null,
        propertyName,
        roomName,
        amountPence: (c.amount_pence as number) ?? 0,
        dueDate: c.due_date as string,
        status: ((c.status as RentRow['status']) ?? 'upcoming') satisfies RentRow['status'],
        daysFromDue,
      };
    })
    .sort((a, b) => statusOrder(a.status) - statusOrder(b.status));

  const rentOverdueCount = rentRows.filter((r) => r.status === 'overdue').length;
  const rentOutstandingPence = rentRows
    .filter((r) => r.status === 'overdue' || r.status === 'due')
    .reduce((sum, r) => sum + Math.max(0, r.amountPence), 0);

  // ---- Alerts -----------------------------------------------------------
  const alerts: DashboardAlert[] = [];
  rentRows
    .filter((r) => r.status === 'overdue')
    .slice(0, 2)
    .forEach((r) => {
      alerts.push({
        id: `rent-${r.id}`,
        kind: 'rent',
        title: `Rent overdue — ${r.tenantName}`,
        meta: `${r.propertyName}${r.roomName ? ` · ${r.roomName}` : ''} · ${Math.abs(r.daysFromDue)} days late`,
        badge: { label: 'Urgent', tone: 'alert' },
        href: `#`,
      });
    });
  tickets
    .filter((t) => t.severity === 'high')
    .slice(0, 2)
    .forEach((t) => {
      const property = properties.find((p) => p.id === t.property_id);
      const reporter = firstProfile(t.profiles)?.full_name ?? 'Tenant';
      alerts.push({
        id: `ticket-${t.id}`,
        kind: 'ticket',
        title: t.title as string,
        meta: `${property?.name ?? 'Property'} · ${humaniseAgo(now, t.created_at as string)} · ${reporter}`,
        badge: { label: 'Open', tone: 'alert' },
        href: `#`,
      });
    });
  compliance
    .filter((c) => c.status === 'due_soon' && c.expires_at && c.expires_at <= amberDate)
    .slice(0, 2)
    .forEach((c) => {
      const property = properties.find((p) => p.id === c.property_id);
      const days = c.expires_at ? Math.max(0, daysBetween(today, c.expires_at as string)) : 0;
      alerts.push({
        id: `compliance-${c.id}`,
        kind: 'compliance',
        title: `${formatComplianceType(c.type as string)} expiring`,
        meta: `${property?.name ?? 'Property'} · Due ${formatShortDate(c.expires_at as string)}`,
        badge: { label: `${days} days`, tone: 'amber' },
        href: `#`,
      });
    });
  tenancyEndings.slice(0, 2).forEach((t) => {
    const property = properties.find((p) => p.id === t.property_id);
    const room = rooms.find((r) => r.id === t.room_id);
    const tenantProfile = firstProfile(t.profiles);
    alerts.push({
      id: `tenancy-${t.id}`,
      kind: 'tenancy',
      title: `Tenancy ending — ${tenantProfile?.full_name ?? 'Tenant'}`,
      meta: `${property?.name ?? 'Property'}${room ? ` · ${room.name}` : ''} · Ends ${formatShortDate(t.end_date as string)}`,
      badge: { label: 'Ending', tone: 'amber' },
      href: `#`,
    });
  });

  // ---- Properties snapshot ---------------------------------------------
  const propertyRows: DashboardPropertyRow[] = properties.slice(0, 3).map((p, i) => {
    const roomsForProperty = rooms.filter((r) => r.property_id === p.id);
    const occupied = roomsForProperty.filter((r) => r.status === 'occupied').length;
    const monthly = activeTenancies
      .filter((t) => t.property_id === p.id)
      .reduce((sum, t) => sum + (t.rent_pence ?? 0), 0);
    const addr = (p.address as { city?: string; postcode?: string } | null) ?? null;
    return {
      id: p.id,
      name: p.name as string,
      city: addr?.city ?? null,
      postcode: addr?.postcode ?? null,
      rooms: roomsForProperty.length,
      occupiedRooms: occupied,
      monthlyRentPence: monthly,
      thumb:
        PROPERTY_THUMBS[i % PROPERTY_THUMBS.length] ??
        (PROPERTY_THUMBS[0] as (typeof PROPERTY_THUMBS)[number]),
    };
  });

  // ---- Maintenance snapshot --------------------------------------------
  const maintenanceRows: DashboardMaintenanceRow[] = tickets.slice(0, 4).map((t) => {
    const propName = properties.find((p) => p.id === t.property_id)?.name ?? 'Property';
    const reporter = firstProfile(t.profiles)?.full_name ?? null;
    return {
      id: t.id as string,
      title: t.title as string,
      property: propName,
      ago: humaniseAgo(now, t.created_at as string),
      reporter,
      severity: (t.severity as DashboardMaintenanceRow['severity']) ?? 'medium',
      status: (t.status as DashboardMaintenanceRow['status']) ?? 'open',
    };
  });

  // ---- Compliance snapshot ---------------------------------------------
  const complianceRows: DashboardComplianceRow[] = compliance
    .filter((c) => c.status !== 'unknown')
    .sort((a, b) => compStatusOrder(a.status) - compStatusOrder(b.status))
    .slice(0, 4)
    .map((c) => {
      const propName = properties.find((p) => p.id === c.property_id)?.name ?? 'Portfolio-wide';
      const days = c.expires_at ? daysBetween(today, c.expires_at as string) : null;
      return {
        id: c.id as string,
        title: `${formatComplianceType(c.type as string)} — ${propName}`,
        property: propName,
        meta: c.expires_at
          ? `${days != null && days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires ${formatShortDate(c.expires_at as string)}`}`
          : 'No expiry set',
        status: (c.status as DashboardComplianceRow['status']) ?? 'unknown',
        daysRemaining: days,
      };
    });

  return {
    greetingName,
    monthLabel,
    todayLabel,
    kpis: {
      rentCollectedPence,
      rentCollectedDeltaPence,
      occupiedRooms,
      totalRooms,
      openTickets: tickets.length,
      openUrgent,
      complianceValid,
      complianceTotal,
      complianceAmber,
    },
    portfolio: {
      propertiesCount: properties.length,
      tenantsCount: activeTenancies.length,
      occupancyRate: totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100),
      rentCollectedPence,
      rentOutstandingPence,
    },
    rentRows: rentRows.slice(0, 5),
    rentOverdueCount,
    alerts: alerts.slice(0, 4),
    properties: propertyRows,
    maintenance: maintenanceRows,
    compliance: complianceRows,
  };
}

// ----- helpers ------------------------------------------------------------

function firstProfile(p: unknown): { full_name: string | null } | null {
  if (!p) return null;
  if (Array.isArray(p)) return (p[0] ?? null) as { full_name: string | null } | null;
  return p as { full_name: string | null };
}

function sumBy<T>(arr: T[], fn: (item: T) => number): number {
  return arr.reduce((sum, item) => sum + fn(item), 0);
}

function daysBetween(a: string, b: string): number {
  const aD = new Date(`${a}T00:00:00Z`).getTime();
  const bD = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((bD - aD) / 86_400_000);
}

function formatISODate(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

function formatSince(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function humaniseAgo(now: Date, iso: string): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604_800) return `${Math.round(diff / 86_400)}d ago`;
  return `${Math.round(diff / 604_800)}w ago`;
}

function statusOrder(s: RentRow['status']): number {
  // overdue first, then due, then upcoming, then paid
  const order: Record<RentRow['status'], number> = {
    overdue: 0,
    due: 1,
    partial: 2,
    pending: 3,
    upcoming: 4,
    paid: 5,
    cancelled: 6,
  };
  return order[s] ?? 99;
}

function compStatusOrder(s: string): number {
  if (s === 'overdue') return 0;
  if (s === 'due_soon') return 1;
  if (s === 'ok') return 2;
  return 3;
}

const COMPLIANCE_LABELS: Record<string, string> = {
  hmo_licence: 'HMO Licence',
  gas_safety: 'Gas safety',
  eicr: 'EICR',
  epc: 'EPC',
  pat_test: 'PAT test',
  fire_risk_assessment: 'Fire risk assessment',
  legionella: 'Legionella',
  right_to_rent: 'Right to Rent',
  smoke_alarm_test: 'Smoke alarm',
  co_alarm_test: 'CO alarm',
  deposit_protection: 'Deposit protection',
};

export function formatComplianceType(type: string): string {
  return COMPLIANCE_LABELS[type] ?? type;
}
