import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ComplianceStatus, ComplianceType } from '@/core/constants/compliance';
import type { TicketCategory, TicketSeverity, TicketStatus } from '@/core/constants/tickets';
import type { TenancyStatus } from '@/core/schemas/tenancy';
import { pickPrimaryTenancy } from './pick-primary-tenancy';
import type {
  EmergencyContact,
  MaintenanceSnapshotRow,
  NoticeRow,
  RecentPaymentRow,
  RentHero,
  RentHeroState,
  TenantComplianceRow,
  TenantDashboardData,
  TenantPrimaryTenancy,
} from './types';

/**
 * Server-side loader for the `/tenant` Home dashboard.
 *
 * Everything the rebuilt home, profile read-only summary and
 * sidebar greeting needs in a single parallel `Promise.all`:
 *
 *   - Caller profile (greeting / initials / emergency contact).
 *   - Active (or pending) tenancies + the picked "primary" one,
 *     hydrated with property, room, landlord (org).
 *   - Rent ledger for the current calendar month + last 5 paid charges.
 *   - Year-to-date paid total (for the Recent payments KPI strip).
 *   - Compliance items for the tenant's property (Right to Rent surface).
 *   - Tickets snapshot (top 2 + counts + avg resolution days).
 *   - Recent notices (`notifications` rows with the right `kind`).
 *
 * All queries run with the request-bound supabase client so RLS does
 * the heavy lifting; we additionally restrict by `tenant_user_id`
 * where the policy isn't strong enough (pending invites surface via
 * `invite_email`, but the Home page never renders those — they live
 * in the legacy invite-accept flow).
 */

const ACTIVE_TENANCY_STATUSES: TenancyStatus[] = [
  'active',
  'awaiting_signature',
  'awaiting_deposit',
  'pending_invite',
];

const RESOLVED_TICKET_STATUSES: TicketStatus[] = ['resolved', 'closed'];

const RENT_METHOD_LABELS: Record<string, string> = {
  manual_bank_transfer: 'Bank transfer',
  manual_cash: 'Cash',
  manual_card: 'Card',
  manual_other: 'Other',
  gocardless_dd: 'Direct Debit',
  truelayer_ob: 'Open Banking',
};

const TICKET_CATEGORY_TONE: Record<TicketCategory, MaintenanceSnapshotRow['iconTone']> = {
  heating_hot_water: 'amber',
  plumbing: 'blue',
  electrical: 'amber',
  appliance: 'forest',
  structural: 'alert',
  damp_mould: 'alert',
  pest: 'alert',
  security: 'blue',
  communal_area: 'forest',
  garden_outdoor: 'forest',
  cleaning: 'forest',
  noise_neighbour: 'amber',
  other: 'forest',
};

export async function loadTenantDashboard(
  supabase: SupabaseClient,
  opts: { userId: string; userEmail?: string | null; now?: Date },
): Promise<TenantDashboardData> {
  const now = opts.now ?? new Date();
  const todayISO = formatISODate(now);
  const monthStart = formatISODate(startOfMonth(now));
  const monthEnd = formatISODate(endOfMonth(now));
  const yearStart = formatISODate(new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
  const yearEnd = formatISODate(new Date(Date.UTC(now.getUTCFullYear(), 11, 31)));

  // 1) Tenant profile (greeting + emergency contact).
  const profileResp = await supabase
    .from('profiles')
    .select('id, full_name, preferred_name, contact_email, contact_phone, emergency_contact')
    .eq('id', opts.userId)
    .maybeSingle();
  const profile = (profileResp.data ?? null) as {
    id: string;
    full_name: string | null;
    preferred_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    emergency_contact: EmergencyContact | null;
  } | null;

  const fullName = profile?.full_name?.trim() || opts.userEmail || 'there';
  const firstName = (profile?.preferred_name?.trim() || fullName.split(/\s+/)[0] || 'there').trim();
  const greetingName = profile?.preferred_name?.trim() || firstName;
  const initials = deriveInitials(fullName);

  // 2) Tenancies for this user. RLS already scopes to their own rows.
  const tenanciesResp = await supabase
    .from('tenancies')
    .select(
      `id, org_id, status, start_date, end_date, rent_pence, rent_frequency, rent_due_day,
       deposit_pence, deposit_scheme, deposit_protected_at, property_id, room_id,
       properties:property_id ( id, name, address ),
       rooms:room_id ( id, name ),
       orgs:org_id ( id, name, slug, contact_email, contact_phone, created_by )`,
    )
    .eq('tenant_user_id', opts.userId)
    .in('status', ACTIVE_TENANCY_STATUSES as unknown as string[])
    .order('start_date', { ascending: false });
  if (tenanciesResp.error) throw tenanciesResp.error;
  const tenancyRows = tenanciesResp.data ?? [];

  // Pending invites for this email (the unfilled handshake stage).
  let invitesCount = 0;
  if (opts.userEmail) {
    const invitesResp = await supabase
      .from('tenancies')
      .select('id', { count: 'exact', head: true })
      .eq('invite_email', opts.userEmail.toLowerCase())
      .eq('status', 'pending_invite');
    invitesCount = invitesResp.count ?? 0;
  }

  const primaryRaw = pickPrimaryTenancy(
    tenancyRows.map((row) => ({
      id: row.id as string,
      status: row.status as TenancyStatus,
      start_date: (row.start_date as string | null) ?? null,
    })),
  );
  const primaryRow = primaryRaw ? (tenancyRows.find((r) => r.id === primaryRaw.id) ?? null) : null;

  // If the tenant has no active tenancy at all, return early with the
  // empty-state shape; the home page renders an invite / "browse rooms"
  // panel in that case.
  if (!primaryRow) {
    return {
      greetingName,
      firstName,
      initials,
      todayLabel: longDate(now),
      monthLabel: monthLabel(now),
      hasInvites: invitesCount > 0,
      inviteCount: invitesCount,
      tenancy: null,
      rentHero: null,
      recentPayments: [],
      paidThisYearPence: 0,
      paidThisYearLabel: yearStart.slice(0, 4),
      notices: [],
      unreadNotificationCount: 0,
      unreadMessageCount: 0,
      maintenance: [],
      maintenanceOpenCount: 0,
      maintenanceResolvedCount: 0,
      maintenanceAvgResolutionDays: null,
      compliance: [],
      emergencyContact: profile?.emergency_contact ?? null,
    };
  }

  // 3) Parallel fan-out: rent, payments, tickets, compliance, notices, landlord profile.
  const tenancyId = primaryRow.id as string;
  const propertyId = primaryRow.property_id as string;
  const tenancyIds = tenancyRows.map((r) => r.id as string);

  const orgRaw = pickFirst<{
    id: string;
    name: string | null;
    slug: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    created_by: string | null;
  }>(primaryRow.orgs);

  const [
    monthChargesResp,
    yearChargesResp,
    recentChargesResp,
    paymentsResp,
    ticketsResp,
    complianceResp,
    noticesResp,
    landlordProfileResp,
  ] = await Promise.all([
    supabase
      .from('rent_charges')
      .select('id, amount_pence, paid_pence, due_date, period_start, status')
      .eq('tenancy_id', tenancyId)
      .gte('period_start', monthStart)
      .lte('period_start', monthEnd),
    supabase
      .from('rent_charges')
      .select('paid_pence')
      .eq('tenancy_id', tenancyId)
      .gte('period_start', yearStart)
      .lte('period_start', yearEnd),
    supabase
      .from('rent_charges')
      .select('id, amount_pence, paid_pence, due_date, period_start, status')
      .eq('tenancy_id', tenancyId)
      .order('period_start', { ascending: false })
      .limit(6),
    supabase
      .from('rent_payments')
      .select('id, charge_id, amount_pence, method, status, paid_at')
      .eq('tenancy_id', tenancyId)
      .eq('status', 'confirmed')
      .order('paid_at', { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from('tickets')
      .select('id, title, status, severity, category, created_at, resolved_at')
      .in('tenancy_id', tenancyIds)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('compliance_items')
      .select('id, type, status, expires_at')
      .eq('property_id', propertyId)
      .order('expires_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('notifications')
      .select('id, kind, title, body, created_at, read_at, link_url, meta')
      .eq('user_id', opts.userId)
      .in('kind', ['compliance_due', 'compliance_overdue', 'system'])
      .order('created_at', { ascending: false })
      .limit(5),
    orgRaw?.created_by
      ? supabase
          .from('profiles')
          .select('id, full_name, contact_email, contact_phone')
          .eq('id', orgRaw.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (monthChargesResp.error) throw monthChargesResp.error;
  if (yearChargesResp.error) throw yearChargesResp.error;
  if (recentChargesResp.error) throw recentChargesResp.error;
  if (paymentsResp.error) throw paymentsResp.error;
  if (ticketsResp.error) throw ticketsResp.error;
  if (complianceResp.error) throw complianceResp.error;
  if (noticesResp.error) throw noticesResp.error;

  const monthCharges = monthChargesResp.data ?? [];
  const yearCharges = yearChargesResp.data ?? [];
  const recentCharges = recentChargesResp.data ?? [];
  const payments = paymentsResp.data ?? [];
  const tickets = ticketsResp.data ?? [];
  const compliance = complianceResp.data ?? [];
  const notices = noticesResp.data ?? [];
  const landlordProfile =
    (
      landlordProfileResp as {
        data?: {
          full_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
        } | null;
      }
    ).data ?? null;

  // 4) Build primary tenancy structure ------------------------------------
  const property = pickFirst<{
    id: string;
    name: string;
    address: { line1?: string; city?: string; postcode?: string } | null;
  }>(primaryRow.properties);
  const room = pickFirst<{ id: string; name: string }>(primaryRow.rooms);
  const startDate = (primaryRow.start_date as string | null) ?? null;
  const endDate = (primaryRow.end_date as string | null) ?? null;
  const totalMonths = startDate && endDate ? monthsBetween(startDate, endDate) : null;
  const monthsElapsed = startDate ? Math.max(0, monthsBetween(startDate, todayISO)) : 0;
  const progressPct =
    totalMonths != null && totalMonths > 0
      ? Math.min(100, Math.round((monthsElapsed / totalMonths) * 100))
      : null;

  const tenancy: TenantPrimaryTenancy = {
    id: tenancyId,
    orgId: (primaryRow.org_id as string) ?? '',
    status: primaryRow.status as TenancyStatus,
    startDate,
    endDate,
    rentPence: (primaryRow.rent_pence as number) ?? 0,
    rentFrequency: (primaryRow.rent_frequency as 'monthly' | 'weekly') ?? 'monthly',
    rentDueDay: (primaryRow.rent_due_day as number | null) ?? null,
    depositPence: (primaryRow.deposit_pence as number) ?? 0,
    depositScheme: (primaryRow.deposit_scheme as string | null) ?? null,
    depositProtectedAt: (primaryRow.deposit_protected_at as string | null) ?? null,
    property: {
      id: property?.id ?? propertyId,
      name: property?.name ?? 'Your home',
      addressLine1: property?.address?.line1 ?? null,
      city: property?.address?.city ?? null,
      postcode: property?.address?.postcode ?? null,
    },
    roomName: room?.name ?? null,
    landlord: {
      userId: orgRaw?.created_by ?? null,
      displayName: landlordProfile?.full_name?.trim() || orgRaw?.name?.trim() || 'Your landlord',
      contactPhone: landlordProfile?.contact_phone ?? orgRaw?.contact_phone ?? null,
      contactEmail: landlordProfile?.contact_email ?? orgRaw?.contact_email ?? null,
    },
    paymentReference: buildPaymentReference({
      orgSlug: orgRaw?.slug ?? null,
      propertyName: property?.name ?? null,
      roomName: room?.name ?? null,
    }),
    monthsElapsed,
    totalMonths,
    progressPct,
  };

  // 5) Rent hero (state of the *current* month's charge) ------------------
  type ChargeRow = {
    id: string;
    amount_pence: number;
    paid_pence: number;
    due_date: string;
    period_start: string;
    status: string;
  };
  const currentCharge = (monthCharges[0] as ChargeRow | undefined) ?? null;
  const matchingPayment = currentCharge
    ? ((
        payments as Array<{ charge_id: string | null; paid_at: string | null; method: string }>
      ).find((p) => p.charge_id === currentCharge.id) ?? null)
    : null;

  const rentHero: RentHero | null = currentCharge
    ? {
        amountPence: currentCharge.amount_pence,
        dueDate: currentCharge.due_date,
        state: rentHeroStateFromCharge(currentCharge, todayISO),
        monthLabel: shortMonthYear(currentCharge.period_start),
        paidOn: matchingPayment?.paid_at ?? null,
        rentMethodLabel: matchingPayment
          ? (RENT_METHOD_LABELS[matchingPayment.method] ?? 'Bank transfer')
          : 'Bank transfer',
      }
    : null;

  // 6) Recent payments timeline ------------------------------------------
  const recentPayments: RecentPaymentRow[] = recentCharges.map((c) => {
    const cr = c as ChargeRow;
    const matched = (
      payments as Array<{ charge_id: string | null; paid_at: string | null; method: string }>
    ).find((p) => p.charge_id === cr.id);
    const daysLate = matched?.paid_at ? Math.max(0, daysBetween(cr.due_date, matched.paid_at)) : 0;
    const state = rentHeroStateFromCharge(cr, todayISO);
    const status: RecentPaymentRow['status'] =
      cr.status === 'paid'
        ? daysLate > 1
          ? 'late'
          : 'paid'
        : state === 'overdue'
          ? 'overdue'
          : 'due';
    return {
      id: cr.id,
      monthLabel: shortMonthYear(cr.period_start),
      amountPence: cr.amount_pence,
      status,
      paidAt: matched?.paid_at ?? null,
      dueDate: cr.due_date,
      methodLabel: matched
        ? (RENT_METHOD_LABELS[matched.method] ?? 'Bank transfer')
        : 'Bank transfer',
      daysLate,
    };
  });

  const paidThisYearPence = yearCharges.reduce(
    (sum, c) => sum + ((c as { paid_pence?: number }).paid_pence ?? 0),
    0,
  );

  // 7) Notices: pick top 3 with a colour cue --------------------------------
  const noticeRows: NoticeRow[] = (
    notices as Array<{
      id: string;
      kind: string;
      title: string;
      body: string | null;
      created_at: string;
      read_at: string | null;
    }>
  )
    .slice(0, 3)
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      dotTone:
        n.kind === 'compliance_overdue'
          ? 'alert'
          : n.kind === 'compliance_due'
            ? 'amber'
            : 'forest',
      createdAt: n.created_at,
    }));

  // 8) Maintenance snapshot ------------------------------------------------
  type TicketLite = {
    id: string;
    title: string;
    status: TicketStatus;
    severity: TicketSeverity;
    category: TicketCategory;
    created_at: string;
    resolved_at: string | null;
  };
  const ticketList = tickets as unknown as TicketLite[];
  const openCount = ticketList.filter(
    (t) => !RESOLVED_TICKET_STATUSES.includes(t.status) && t.status !== 'cancelled',
  ).length;
  const resolvedTickets = ticketList.filter(
    (t) => t.status === 'resolved' || t.status === 'closed',
  );
  const resolutionDays = resolvedTickets
    .map((t) => (t.resolved_at ? daysBetween(t.created_at, t.resolved_at) : null))
    .filter((d): d is number => d != null);
  const avgResolutionDays =
    resolutionDays.length === 0
      ? null
      : Math.max(1, Math.round(resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length));

  const maintenance: MaintenanceSnapshotRow[] = ticketList.slice(0, 2).map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    status: t.status,
    severity: t.severity,
    reportedAt: t.created_at,
    resolvedAt: t.resolved_at,
    iconTone: TICKET_CATEGORY_TONE[t.category] ?? 'forest',
  }));

  // 9) Compliance summary for the property -------------------------------
  const complianceRows: TenantComplianceRow[] = (
    compliance as Array<{ id: string; type: string; status: string; expires_at: string | null }>
  ).map((c) => ({
    id: c.id,
    type: c.type as ComplianceType,
    status: c.status as ComplianceStatus,
    expiresAt: c.expires_at,
  }));

  return {
    greetingName,
    firstName,
    initials,
    todayLabel: longDate(now),
    monthLabel: monthLabel(now),
    hasInvites: invitesCount > 0,
    inviteCount: invitesCount,
    tenancy,
    rentHero,
    recentPayments: recentPayments.slice(0, 5),
    paidThisYearPence,
    paidThisYearLabel: String(now.getUTCFullYear()),
    notices: noticeRows,
    unreadNotificationCount: 0,
    unreadMessageCount: 0,
    maintenance,
    maintenanceOpenCount: openCount,
    maintenanceResolvedCount: resolvedTickets.length,
    maintenanceAvgResolutionDays: avgResolutionDays,
    compliance: complianceRows,
    emergencyContact: profile?.emergency_contact ?? null,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'T';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase() || 'T';
}

function rentHeroStateFromCharge(
  charge: { status: string; due_date: string; paid_pence: number; amount_pence: number },
  todayISO: string,
): RentHeroState {
  if (charge.status === 'paid') return 'paid';
  if (charge.status === 'overdue' || charge.due_date < todayISO) return 'overdue';
  if (charge.status === 'due') return 'due';
  return 'upcoming';
}

function buildPaymentReference(opts: {
  orgSlug: string | null;
  propertyName: string | null;
  roomName: string | null;
}): string {
  const slug = (opts.orgSlug ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  const prop = (opts.propertyName ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase();
  const room = (opts.roomName ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  return [slug || 'RENT', prop || 'HOME', room || 'R1'].join('-');
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function formatISODate(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function longDate(d: Date): string {
  return d.toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function monthLabel(d: Date): string {
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

function shortMonthYear(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${bIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function monthsBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${bIso.slice(0, 10)}T00:00:00Z`);
  const months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  return Math.max(0, months);
}
