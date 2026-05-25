import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Loader for /landlord/[slug]/finance — the design's monthly Rent table.
 *
 * Returns the four KPI scalars + one row per rent_charge for the selected
 * month, denormalised with tenant + property + room names. Sorted with
 * overdue rows first.
 */

export type RentMonthRow = {
  id: string;
  tenancyId: string;
  tenantName: string;
  tenantInitials: string;
  propertyName: string | null;
  roomName: string | null;
  amountPence: number;
  paidPence: number;
  dueDate: string;
  receivedOn: string | null;
  method: string | null;
  status: 'paid' | 'overdue' | 'due' | 'upcoming' | 'partial' | 'pending' | 'cancelled';
  daysFromDue: number;
};

export type RentMonthKpis = {
  collectedPence: number;
  outstandingPence: number;
  dueThisWeekPence: number;
  monthlyTotalDuePence: number;
  collectionPct: number;
  overdueTenantsCount: number;
  dueThisWeekTenantsCount: number;
};

export type RentMonthData = {
  monthIso: string;
  monthLabel: string;
  rows: RentMonthRow[];
  kpis: RentMonthKpis;
  availableMonths: string[];
};

export async function loadRentMonth(
  supabase: SupabaseClient,
  orgId: string,
  monthIso: string,
  now: Date = new Date(),
): Promise<RentMonthData> {
  const monthDate = parseMonthIso(monthIso) ?? startOfMonth(now);
  const periodStart = formatISODate(monthDate);
  const periodEnd = formatISODate(endOfMonth(monthDate));
  const today = formatISODate(now);
  const oneWeekOut = formatISODate(addDays(now, 7));

  const [chargesResp, paymentsResp, monthsResp] = await Promise.all([
    supabase
      .from('rent_charges')
      .select(
        'id, tenancy_id, amount_pence, paid_pence, due_date, status, tenancies!inner(property_id, room_id, tenant_user_id, properties:property_id(name), rooms:room_id(name))',
      )
      .eq('org_id', orgId)
      .gte('period_start', periodStart)
      .lte('period_start', periodEnd)
      .order('due_date', { ascending: true }),
    supabase
      .from('rent_payments')
      .select('charge_id, method, paid_at')
      .eq('org_id', orgId)
      .gte('paid_at', `${periodStart}T00:00:00Z`)
      .lte('paid_at', `${periodEnd}T23:59:59Z`),
    supabase
      .from('rent_charges')
      .select('period_start')
      .eq('org_id', orgId)
      .order('period_start', { ascending: false })
      .limit(200),
  ]);
  if (chargesResp.error) throw chargesResp.error;
  if (paymentsResp.error) throw paymentsResp.error;
  if (monthsResp.error) throw monthsResp.error;

  // Lookup tenant profiles in a separate query — PostgREST won't follow the
  // tenancies→profiles chain reliably when the rent_charges row is the
  // outer table, so we hydrate names client-side.
  const tenantIds = Array.from(
    new Set(
      (chargesResp.data ?? [])
        .map((c) => pickFirst<{ tenant_user_id: string | null }>(c.tenancies)?.tenant_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const profilesById = new Map<
    string,
    { full_name: string | null; contact_email: string | null }
  >();
  if (tenantIds.length > 0) {
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, full_name, contact_email')
      .in('id', tenantIds);
    if (profilesErr) throw profilesErr;
    for (const p of profiles ?? []) {
      profilesById.set(p.id as string, {
        full_name: (p.full_name as string | null) ?? null,
        contact_email: (p.contact_email as string | null) ?? null,
      });
    }
  }

  // Aggregate payments by charge so we can show "Method" and "Received".
  type PaymentInfo = { method: string; paidAt: string };
  const paymentsByCharge = new Map<string, PaymentInfo>();
  for (const p of paymentsResp.data ?? []) {
    if (!p.charge_id) continue;
    const existing = paymentsByCharge.get(p.charge_id as string);
    if (!existing || (p.paid_at as string) > existing.paidAt) {
      paymentsByCharge.set(p.charge_id as string, {
        method: (p.method as string) ?? '—',
        paidAt: p.paid_at as string,
      });
    }
  }

  const rows: RentMonthRow[] = (chargesResp.data ?? []).map((c): RentMonthRow => {
    const tenancyJoin = pickFirst<{
      property_id: string;
      room_id: string | null;
      tenant_user_id: string | null;
      properties: unknown;
      rooms: unknown;
    }>(c.tenancies);
    const property = pickFirst<{ name: string }>(tenancyJoin?.properties);
    const room = pickFirst<{ name: string }>(tenancyJoin?.rooms);
    const profile = tenancyJoin?.tenant_user_id
      ? (profilesById.get(tenancyJoin.tenant_user_id) ?? null)
      : null;
    const tenantName = profile?.full_name ?? profile?.contact_email ?? 'Pending tenant';
    const payment = paymentsByCharge.get(c.id as string);
    const dueDate = c.due_date as string;
    const status = (c.status as RentMonthRow['status']) ?? 'upcoming';
    return {
      id: c.id as string,
      tenancyId: c.tenancy_id as string,
      tenantName,
      tenantInitials: initials(tenantName),
      propertyName: property?.name ?? null,
      roomName: room?.name ?? null,
      amountPence: (c.amount_pence as number) ?? 0,
      paidPence: (c.paid_pence as number) ?? 0,
      dueDate,
      receivedOn: payment?.paidAt
        ? new Date(payment.paidAt).toISOString().slice(0, 10)
        : status === 'paid'
          ? dueDate
          : null,
      method: payment?.method ?? null,
      status,
      daysFromDue: daysBetween(today, dueDate),
    };
  });

  // Sort overdue first, then due, then upcoming, then paid (newest first).
  const order: Record<RentMonthRow['status'], number> = {
    overdue: 0,
    due: 1,
    partial: 2,
    pending: 3,
    upcoming: 4,
    paid: 5,
    cancelled: 6,
  };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.dueDate.localeCompare(b.dueDate));

  const monthlyTotalDuePence = rows.reduce((sum, r) => sum + r.amountPence, 0);
  const collectedPence = rows.reduce(
    (sum, r) => sum + (r.status === 'paid' ? r.amountPence : Math.min(r.paidPence, r.amountPence)),
    0,
  );
  const outstandingPence = rows
    .filter((r) => r.status === 'overdue')
    .reduce((sum, r) => sum + Math.max(0, r.amountPence - r.paidPence), 0);
  const dueThisWeek = rows.filter(
    (r) => r.status !== 'paid' && r.dueDate >= today && r.dueDate <= oneWeekOut,
  );
  const dueThisWeekPence = dueThisWeek.reduce((sum, r) => sum + (r.amountPence - r.paidPence), 0);

  const availableMonths = Array.from(
    new Set((monthsResp.data ?? []).map((r) => (r.period_start as string).slice(0, 7))),
  ).sort((a, b) => b.localeCompare(a));

  return {
    monthIso: periodStart,
    monthLabel: monthDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    rows,
    kpis: {
      collectedPence,
      outstandingPence,
      dueThisWeekPence,
      monthlyTotalDuePence,
      collectionPct:
        monthlyTotalDuePence === 0 ? 0 : Math.round((collectedPence / monthlyTotalDuePence) * 100),
      overdueTenantsCount: rows.filter((r) => r.status === 'overdue').length,
      dueThisWeekTenantsCount: dueThisWeek.length,
    },
    availableMonths,
  };
}

// helpers -----------------------------------------------------------------

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function parseMonthIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!year || !month || month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
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

function formatISODate(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}
