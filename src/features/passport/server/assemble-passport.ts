import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { PassportData } from '@/core/schemas/passport';
import {
  deriveRtrDisplayStatus,
  type PaymentInputCharge,
  sortTenanciesNewestFirst,
  summarisePayments,
} from '@/core/utils/passport-stats';
import { monthlyRentPenceFrom } from '@/core/utils/tenancy-rules';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Assemble a fresh passport snapshot for the calling user.
 *
 * "Fresh" = read-through from the system of record on every call.
 * The passport is never cached server-side; the only persisted
 * artefact is the generated PDF (one row per export in
 * `passport_exports`).
 *
 * Authorisation: the caller can only ever see their own data —
 * every join is rooted at `tenancies.tenant_user_id = auth.uid()`,
 * and we use the request-bound supabase client (RLS-enforced).
 *
 * Two entry points:
 *   - `assemblePassportForCaller(ctx)` — for route handlers.
 *   - `assemblePassportForUser(sb, user)` — for RSC loaders that
 *     don't have a HandlerContext.
 */
export async function assemblePassportForCaller(ctx: HandlerContext): Promise<PassportData> {
  const user = requireUser(ctx);
  return assemblePassportForUser(ctx.supabase, user);
}

export async function assemblePassportForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<PassportData> {
  const [profileResult, tenanciesResult, complianceResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, contact_phone, created_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('tenancies')
      .select(
        `id, status, start_date, end_date, rent_pence, rent_frequency,
         properties:property_id ( name, address ),
         rooms:room_id ( name )`,
      )
      .eq('tenant_user_id', user.id),
    supabase
      .from('compliance_items')
      .select('status, issued_at, expires_at')
      .eq('type', 'right_to_rent')
      .order('expires_at', { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  if (profileResult.error) throw new DbError(profileResult.error);
  if (tenanciesResult.error) throw new DbError(tenanciesResult.error);
  if (complianceResult.error) throw new DbError(complianceResult.error);

  const tenancyRows = tenanciesResult.data ?? [];

  // Pull rent ledger per tenancy in parallel. We're scoped per-user
  // already so this is bounded (a tenant has 1-3 active tenancies in
  // practice).
  const tenancyIds = tenancyRows.map((t) => t.id);
  const chargesPerTenancy: PaymentInputCharge[] = [];
  if (tenancyIds.length > 0) {
    const [chargesResult, paymentsResult] = await Promise.all([
      supabase
        .from('rent_charges')
        .select('id, tenancy_id, due_date, amount_pence')
        .in('tenancy_id', tenancyIds),
      supabase
        .from('rent_payments')
        .select('charge_id, paid_at, amount_pence, status')
        .in('tenancy_id', tenancyIds)
        .not('charge_id', 'is', null),
    ]);
    if (chargesResult.error) throw new DbError(chargesResult.error);
    if (paymentsResult.error) throw new DbError(paymentsResult.error);

    const paymentsByCharge = new Map<
      string,
      Array<{ paid_at: string; amount_pence: number; status: 'pending' | 'paid' | 'failed' }>
    >();
    for (const p of paymentsResult.data ?? []) {
      if (!p.charge_id) continue;
      const list = paymentsByCharge.get(p.charge_id) ?? [];
      // Map db enum (`pending|confirmed|failed|charged_back|refunded`)
      // → the small union the pure summariser understands. Refunded
      // and charged_back count as failed so the band reflects the
      // tenant's net record.
      const dbStatus = (p.status ?? 'pending') as
        | 'pending'
        | 'confirmed'
        | 'failed'
        | 'charged_back'
        | 'refunded';
      const mappedStatus: 'pending' | 'paid' | 'failed' =
        dbStatus === 'confirmed' ? 'paid' : dbStatus === 'pending' ? 'pending' : 'failed';
      list.push({
        paid_at: (p.paid_at ?? '') as string,
        amount_pence: p.amount_pence ?? 0,
        status: mappedStatus,
      });
      paymentsByCharge.set(p.charge_id, list);
    }

    for (const c of chargesResult.data ?? []) {
      const charges = paymentsByCharge.get(c.id) ?? [];
      // Skip charges without any paid_at to avoid noisy date sorts.
      const validPayments = charges.filter((p) => Boolean(p.paid_at));
      validPayments.sort((a, b) => (a.paid_at < b.paid_at ? -1 : 1));
      chargesPerTenancy.push({
        due_date: c.due_date,
        total_pence: c.amount_pence,
        payments: validPayments,
      });
    }
  }

  const tenancyEntries = sortTenanciesNewestFirst(
    tenancyRows.map((t) => {
      const property = pickFirst<{
        name: string;
        address: { line1: string; line2?: string | null; city: string; postcode: string };
      }>(t.properties);
      const room = pickFirst<{ name: string }>(t.rooms);
      const addr = property?.address;
      // Tenancies store rent in their per-period unit + a `rent_frequency`
      // enum. The passport always renders monthly equivalents so the
      // band stays comparable across weekly and monthly leases.
      const monthlyRent =
        typeof t.rent_pence === 'number'
          ? monthlyRentPenceFrom(t.rent_pence, t.rent_frequency ?? 'monthly')
          : null;
      return {
        tenancy_id: t.id,
        property_name: property?.name ?? 'Property',
        property_address: addr
          ? [addr.line1, addr.line2, addr.city, addr.postcode]
              .filter((s): s is string => Boolean(s))
              .join(', ')
          : '',
        room_name: room?.name ?? null,
        start_date: t.start_date,
        end_date: t.end_date,
        monthly_rent_pence: monthlyRent,
        status: t.status,
      };
    }),
  );

  const rtrItem = (complianceResult.data ?? [])[0] ?? null;
  const rtr = deriveRtrDisplayStatus(
    rtrItem
      ? {
          status: rtrItem.status as 'ok' | 'due_soon' | 'overdue' | 'unknown',
          issued_at: rtrItem.issued_at,
          expires_at: rtrItem.expires_at,
        }
      : null,
  );

  const payments = summarisePayments(chargesPerTenancy);

  // Documents: list anything visible to the tenant via RLS in the
  // `documents` table. This is a best-effort listing — failures are
  // tolerated so a missing documents table policy doesn't crash the
  // passport generation.
  let documents: Array<{ kind: string; title: string; added_at: string }> = [];
  try {
    const { data: docs } = await supabase
      .from('documents')
      .select('kind, title, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    documents = (docs ?? [])
      .filter((d): d is { kind: string; title: string | null; created_at: string } =>
        Boolean(d.created_at && d.kind),
      )
      .map((d) => ({
        kind: d.kind,
        title: d.title ?? d.kind,
        added_at: d.created_at,
      }));
  } catch {
    documents = [];
  }

  return PassportData.parse({
    generated_at: new Date().toISOString(),
    identity: {
      full_name: profileResult.data?.full_name ?? user.email ?? 'Tenantly user',
      email: user.email ?? '',
      phone: profileResult.data?.contact_phone ?? null,
      member_since: profileResult.data?.created_at ?? user.created_at ?? new Date().toISOString(),
    },
    right_to_rent: rtr,
    tenancies: tenancyEntries,
    payments,
    documents,
  });
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
