import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Loader for the /landlord/[slug]/tenancies page (the design titles it
 * "Tenants"). Returns a denormalised row per active or pending-invite
 * tenancy with everything the design table needs: tenant name + phone,
 * property+room labels, rent/deposit, tenancy window, and a snapshot of
 * the most recent rent_charge so we can render the payment status pill.
 *
 * Tenancies in `ended` / `cancelled` states are filtered out here — the
 * design only shows live tenants (with an explicit "Ending" tab for
 * tenancies whose end_date is within 60 days).
 */

export type TenantRow = {
  id: string;
  tenantName: string;
  tenantPhone: string | null;
  propertyName: string | null;
  roomName: string | null;
  startDate: string;
  endDate: string | null;
  rentPence: number;
  rentFrequency: 'monthly' | 'weekly';
  depositPence: number;
  depositScheme: string | null;
  tenancyStatus: string;
  paymentStatus:
    | 'paid'
    | 'overdue'
    | 'due'
    | 'upcoming'
    | 'partial'
    | 'pending'
    | 'cancelled'
    | 'no_charge';
  paymentDaysFromDue: number;
};

export async function loadLandlordTenants(
  supabase: SupabaseClient,
  orgId: string,
  now: Date = new Date(),
): Promise<TenantRow[]> {
  const today = formatISODate(now);
  const periodStart = formatISODate(startOfMonth(now));
  const periodEnd = formatISODate(endOfMonth(now));

  const { data: tenancies, error } = await supabase
    .from('tenancies')
    .select(
      `id, status, start_date, end_date, rent_pence, rent_frequency, deposit_pence, deposit_scheme,
       tenant_user_id, invite_email,
       properties:property_id (name),
       rooms:room_id (name),
       profiles:tenant_user_id (full_name, contact_phone, contact_email)`,
    )
    .eq('org_id', orgId)
    .in('status', ['active', 'pending_invite', 'awaiting_signature', 'awaiting_deposit'])
    .order('start_date', { ascending: false });
  if (error) throw error;

  const ids = (tenancies ?? []).map((t) => t.id as string);
  const { data: charges, error: chargesError } = ids.length
    ? await supabase
        .from('rent_charges')
        .select('tenancy_id, due_date, status, period_start')
        .in('tenancy_id', ids)
        .gte('period_start', periodStart)
        .lte('period_start', periodEnd)
    : { data: [], error: null };
  if (chargesError) throw chargesError;

  const chargeByTenancy = new Map<string, { dueDate: string; status: string }>();
  for (const c of charges ?? []) {
    chargeByTenancy.set(c.tenancy_id as string, {
      dueDate: c.due_date as string,
      status: c.status as string,
    });
  }

  return (tenancies ?? []).map((t): TenantRow => {
    const property = pickFirst<{ name: string }>(t.properties);
    const room = pickFirst<{ name: string }>(t.rooms);
    const profile = pickFirst<{
      full_name: string | null;
      contact_phone: string | null;
      contact_email: string | null;
    }>(t.profiles);
    const charge = chargeByTenancy.get(t.id as string);
    let paymentStatus: TenantRow['paymentStatus'] = 'no_charge';
    let paymentDaysFromDue = 0;
    if (charge) {
      paymentStatus = (charge.status as TenantRow['paymentStatus']) ?? 'upcoming';
      paymentDaysFromDue = daysBetween(today, charge.dueDate);
    }
    const tenantName = profile?.full_name ?? (t.invite_email as string | null) ?? 'Invited tenant';
    return {
      id: t.id as string,
      tenantName,
      tenantPhone: profile?.contact_phone ?? null,
      propertyName: property?.name ?? null,
      roomName: room?.name ?? null,
      startDate: t.start_date as string,
      endDate: (t.end_date as string | null) ?? null,
      rentPence: (t.rent_pence as number) ?? 0,
      rentFrequency: (t.rent_frequency as 'monthly' | 'weekly') ?? 'monthly',
      depositPence: (t.deposit_pence as number) ?? 0,
      depositScheme: (t.deposit_scheme as string | null) ?? null,
      tenancyStatus: t.status as string,
      paymentStatus,
      paymentDaysFromDue,
    };
  });
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000,
  );
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
