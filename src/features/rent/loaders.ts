import 'server-only';
import { z } from 'zod';
import { uuid } from '@/core/schemas/common';
import {
  type RentCharge,
  RentCharge as RentChargeSchema,
  TenancyArrears,
} from '@/core/schemas/rent';
import { totalArrearsPence } from '@/core/utils/rent-rules';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-only loaders for rent UI. Mirrors `compliance/loaders.ts` style.
 */

export type RentTenancyOverview = {
  tenancyId: string;
  propertyId: string;
  propertyName: string;
  roomName: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  rentPence: number;
  rentFrequency: 'monthly' | 'weekly';
  arrearsPence: number;
  overdueCount: number;
  nextDueDate: string | null;
  status: string;
};

export type RentDashboardData = {
  totalArrearsPence: number;
  totalCollectedThisMonthPence: number;
  totalDueThisMonthPence: number;
  tenancies: RentTenancyOverview[];
  recentCharges: RentCharge[];
};

const TenancyJoinRow = z.object({
  id: uuid,
  property_id: uuid,
  rent_pence: z.number().int(),
  rent_frequency: z.enum(['monthly', 'weekly']),
  status: z.string(),
  invite_email: z.string().nullable().optional(),
  tenant_user_id: uuid.nullable().optional(),
  properties: z
    .union([z.object({ name: z.string() }), z.array(z.object({ name: z.string() }))])
    .nullable()
    .optional(),
  rooms: z
    .union([z.object({ name: z.string() }), z.array(z.object({ name: z.string() }))])
    .nullable()
    .optional(),
});

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

/** Org-level rent dashboard summary. */
export async function loadOrgRentDashboard(orgId: string): Promise<RentDashboardData> {
  const supabase = await createClient();

  const [tenanciesRes, arrearsRes, chargesRes] = await Promise.all([
    supabase
      .from('tenancies')
      .select(
        `id, property_id, rent_pence, rent_frequency, status, invite_email, tenant_user_id,
         properties:property_id (name),
         rooms:room_id (name)`,
      )
      .eq('org_id', orgId)
      .in('status', ['active', 'awaiting_signature', 'awaiting_deposit', 'pending_invite']),
    supabase.from('tenancy_arrears').select('*').eq('org_id', orgId),
    supabase
      .from('rent_charges')
      .select('*')
      .eq('org_id', orgId)
      .order('due_date', { ascending: false })
      .limit(50),
  ]);

  if (tenanciesRes.error) throw tenanciesRes.error;
  if (arrearsRes.error) throw arrearsRes.error;
  if (chargesRes.error) throw chargesRes.error;

  const arrearsByTenancy = new Map<string, z.infer<typeof TenancyArrears>>();
  for (const a of arrearsRes.data ?? []) {
    const parsed = TenancyArrears.parse(a);
    arrearsByTenancy.set(parsed.tenancy_id, parsed);
  }

  // Look up tenant profiles in a second pass — Supabase doesn't auto-join
  // through `tenant_user_id` because it points into auth.users.
  const tenantUserIds = (tenanciesRes.data ?? [])
    .map((row) => row.tenant_user_id as string | null)
    .filter((id): id is string => Boolean(id));

  const profilesMap = new Map<string, { full_name: string | null; contact_email: string | null }>();
  if (tenantUserIds.length > 0) {
    const profilesRes = await supabase
      .from('profiles')
      .select('id, full_name, contact_email')
      .in('id', tenantUserIds);
    if (profilesRes.error) throw profilesRes.error;
    for (const p of profilesRes.data ?? []) {
      profilesMap.set(p.id as string, {
        full_name: (p.full_name as string | null) ?? null,
        contact_email: (p.contact_email as string | null) ?? null,
      });
    }
  }

  const tenancies: RentTenancyOverview[] = (tenanciesRes.data ?? []).map((raw) => {
    const t = TenancyJoinRow.parse(raw);
    const property = pickFirst<{ name: string }>(t.properties);
    const room = pickFirst<{ name: string }>(t.rooms);
    const profile = t.tenant_user_id ? profilesMap.get(t.tenant_user_id) : undefined;
    const arrears = arrearsByTenancy.get(t.id);
    return {
      tenancyId: t.id,
      propertyId: t.property_id,
      propertyName: property?.name ?? 'Property',
      roomName: room?.name ?? null,
      tenantName: profile?.full_name ?? null,
      tenantEmail: profile?.contact_email ?? t.invite_email ?? null,
      rentPence: t.rent_pence,
      rentFrequency: t.rent_frequency,
      arrearsPence: arrears?.arrears_pence ?? 0,
      overdueCount: arrears?.overdue_count ?? 0,
      nextDueDate: arrears?.next_due_date ?? null,
      status: t.status,
    };
  });

  const charges = (chargesRes.data ?? []).map((r) => RentChargeSchema.parse(r));

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  let collectedThisMonth = 0;
  let dueThisMonth = 0;
  for (const c of charges) {
    if (c.due_date >= monthStart && c.due_date <= monthEnd) {
      dueThisMonth += c.amount_pence;
      collectedThisMonth += Math.min(c.paid_pence, c.amount_pence);
    }
  }

  return {
    totalArrearsPence: tenancies.reduce((sum, t) => sum + Math.max(t.arrearsPence, 0), 0),
    totalCollectedThisMonthPence: collectedThisMonth,
    totalDueThisMonthPence: dueThisMonth,
    tenancies: tenancies.sort((a, b) => b.arrearsPence - a.arrearsPence),
    recentCharges: charges.slice(0, 10),
  };
}

export type TenancyRentDetail = {
  charges: RentCharge[];
  payments: Array<{
    id: string;
    org_id: string;
    tenancy_id: string;
    charge_id: string | null;
    amount_pence: number;
    method: string;
    status: string;
    paid_at: string | null;
    notes: string | null;
    created_at: string;
  }>;
  arrearsPence: number;
};

/** Per-tenancy ledger view (charges + payments). */
export async function loadTenancyRent(tenancyId: string): Promise<TenancyRentDetail> {
  const supabase = await createClient();
  const [chargesRes, paymentsRes] = await Promise.all([
    supabase
      .from('rent_charges')
      .select('*')
      .eq('tenancy_id', tenancyId)
      .order('period_start', { ascending: false }),
    supabase
      .from('rent_payments')
      .select('*')
      .eq('tenancy_id', tenancyId)
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ]);

  if (chargesRes.error) throw chargesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  const charges = (chargesRes.data ?? []).map((r) => RentChargeSchema.parse(r));

  return {
    charges,
    payments: (paymentsRes.data ?? []) as TenancyRentDetail['payments'],
    arrearsPence: totalArrearsPence(charges),
  };
}

// ============================================================================
// Tenant Payments page — flat charge + payment view + KPI strip
// ============================================================================

export type TenantPaymentRow = {
  id: string;
  monthLabel: string;
  periodStart: string;
  dueDate: string;
  paidAt: string | null;
  amountPence: number;
  paidPence: number;
  status: 'paid' | 'paid_late' | 'due' | 'overdue' | 'upcoming' | 'cancelled' | 'partial';
  daysLate: number;
  methodLabel: string;
  reference: string;
};

export type TenantPaymentsView = {
  year: number | 'all';
  availableYears: number[];
  rows: TenantPaymentRow[];
  reference: string;
  next: {
    monthLabel: string;
    amountPence: number;
    dueDate: string;
  } | null;
  kpis: {
    paidThisYearPence: number;
    monthlyRentPence: number;
    depositPence: number;
    depositSchemeLabel: string | null;
    nextPaymentDueDate: string | null;
  };
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  manual_bank_transfer: 'Bank transfer',
  manual_cash: 'Cash',
  manual_card: 'Card',
  manual_other: 'Other',
  gocardless_dd: 'Direct Debit',
  truelayer_ob: 'Open Banking',
};

/**
 * Build the flat table that the rebuilt `/tenant/rent/[tenancyId]` page
 * renders — one row per charge plus the matching payment metadata, KPIs
 * for the headline strip and the "next payment" banner.
 *
 *  - `year = 'all'` returns everything, sorted newest first.
 *  - `year = 2025` only includes charges whose `period_start` falls in
 *    the calendar year, but the KPIs always reflect *the current year*
 *    so the strip stays stable regardless of which year the user picks.
 */
export async function loadTenantPaymentsView(
  tenancyId: string,
  year: number | 'all' = 'all',
): Promise<TenantPaymentsView> {
  const supabase = await createClient();
  const detail = await loadTenancyRent(tenancyId);

  const tenancyResp = await supabase
    .from('tenancies')
    .select(
      `id, rent_pence, deposit_pence, deposit_scheme,
       orgs:org_id ( slug ),
       properties:property_id ( name ),
       rooms:room_id ( name )`,
    )
    .eq('id', tenancyId)
    .maybeSingle();
  if (tenancyResp.error) throw tenancyResp.error;
  const tenancyRow = tenancyResp.data;
  const monthlyRent = (tenancyRow?.rent_pence as number | undefined) ?? 0;
  const depositPence = (tenancyRow?.deposit_pence as number | undefined) ?? 0;
  const depositScheme = (tenancyRow?.deposit_scheme as string | null | undefined) ?? null;
  const org = pickFirst<{ slug: string | null }>(tenancyRow?.orgs);
  const property = pickFirst<{ name: string }>(tenancyRow?.properties);
  const room = pickFirst<{ name: string }>(tenancyRow?.rooms);

  const reference = buildReference({
    orgSlug: org?.slug ?? null,
    propertyName: property?.name ?? null,
    roomName: room?.name ?? null,
  });

  const paymentByCharge = new Map<string, (typeof detail.payments)[number]>();
  for (const p of detail.payments) {
    if (p.charge_id && p.status === 'confirmed') {
      paymentByCharge.set(p.charge_id, p);
    }
  }

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  const rowsAll: TenantPaymentRow[] = detail.charges.map((c) => {
    const payment = paymentByCharge.get(c.id);
    const daysLate = payment?.paid_at
      ? Math.max(0, daysBetweenIso(c.due_date, payment.paid_at))
      : 0;
    let status: TenantPaymentRow['status'];
    if (c.status === 'paid') status = daysLate > 1 ? 'paid_late' : 'paid';
    else if (c.status === 'cancelled') status = 'cancelled';
    else if (c.status === 'partially_paid') status = 'partial';
    else if (c.status === 'overdue' || c.due_date < todayISO) status = 'overdue';
    else if (c.status === 'due') status = 'due';
    else status = 'upcoming';

    return {
      id: c.id,
      monthLabel: shortMonthYear(c.period_start),
      periodStart: c.period_start,
      dueDate: c.due_date,
      paidAt: payment?.paid_at ?? null,
      amountPence: c.amount_pence,
      paidPence: c.paid_pence,
      status,
      daysLate,
      methodLabel: payment
        ? (PAYMENT_METHOD_LABELS[payment.method] ?? 'Bank transfer')
        : 'Bank transfer',
      reference,
    };
  });

  const yearsSet = new Set<number>(rowsAll.map((r) => new Date(r.periodStart).getUTCFullYear()));
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  const rows =
    year === 'all'
      ? rowsAll
      : rowsAll.filter((r) => new Date(r.periodStart).getUTCFullYear() === year);

  // KPIs always reference the current calendar year so the strip is stable.
  const currentYear = today.getUTCFullYear();
  const paidThisYearPence = rowsAll
    .filter((r) => new Date(r.periodStart).getUTCFullYear() === currentYear)
    .reduce((sum, r) => sum + r.paidPence, 0);

  // Next upcoming/due charge (closest future due_date that isn't paid).
  const next = rowsAll
    .filter((r) => r.status !== 'paid' && r.status !== 'paid_late' && r.status !== 'cancelled')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  return {
    year,
    availableYears,
    rows,
    reference,
    next: next
      ? {
          monthLabel: next.monthLabel,
          amountPence: next.amountPence,
          dueDate: next.dueDate,
        }
      : null,
    kpis: {
      paidThisYearPence,
      monthlyRentPence: monthlyRent,
      depositPence,
      depositSchemeLabel: depositScheme ? depositScheme.toUpperCase() : null,
      nextPaymentDueDate: next?.dueDate ?? null,
    },
  };
}

function buildReference(opts: {
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

function shortMonthYear(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}

function daysBetweenIso(a: string, b: string): number {
  const aD = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const bD = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  return Math.round((bD - aD) / 86_400_000);
}
