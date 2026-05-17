import { BookUser, Building2, CalendarClock, Home, Inbox, Mail } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplianceStatus, ComplianceType } from '@/core/constants/compliance';
import type { AstEnvelope } from '@/core/schemas/ast';
import { RentCharge } from '@/core/schemas/rent';
import { formatMoney } from '@/core/utils/money';
import { AstStatusCard } from '@/features/ast/components/ast-status-card';
import { loadActiveEnvelopeForTenancy } from '@/features/ast/loaders';
import { TenantBillsCard } from '@/features/bills/components/tenant-bills-card';
import { loadBillsForTenancy, type TenantBillRow } from '@/features/bills/loaders';
import { TenantComplianceSummary } from '@/features/compliance/components/tenant-compliance-summary';
import { TenantRentSummary } from '@/features/rent/components/tenant-rent-summary';
import { TenantMaintenanceSummary } from '@/features/tickets/components/tenant-maintenance-summary';
import { loadTenantTicketsBoard } from '@/features/tickets/loaders';
import { createClient } from '@/lib/supabase/server';

const ACTIVE_STATUSES = [
  'pending_invite',
  'awaiting_signature',
  'awaiting_deposit',
  'active',
] as const;

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

type StatusMeta = { label: string; tone: string };

const STATUS_LABEL: Record<string, StatusMeta> = {
  pending_invite: { label: 'Awaiting your accept', tone: 'bg-amber-500/10 text-amber-700' },
  awaiting_signature: { label: 'Sign your tenancy', tone: 'bg-amber-500/10 text-amber-700' },
  awaiting_deposit: { label: 'Awaiting deposit', tone: 'bg-amber-500/10 text-amber-700' },
  active: { label: 'Active', tone: 'bg-emerald-500/10 text-emerald-700' },
};

const FALLBACK_STATUS: StatusMeta = { label: 'Active', tone: 'bg-emerald-500/10 text-emerald-700' };

export default async function TenantDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant');

  const { data: tenancies } = await supabase
    .from('tenancies')
    .select(
      `id, status, start_date, end_date, rent_pence, rent_frequency, rent_due_day,
       deposit_pence, deposit_scheme, deposit_protected_at, property_id,
       properties:property_id ( name, address ),
       rooms:room_id ( name )`,
    )
    .eq('tenant_user_id', user.id)
    .in('status', ACTIVE_STATUSES as unknown as string[])
    .order('start_date', { ascending: false });

  const list = tenancies ?? [];

  // Pull compliance items for each tenancy's property. RLS lets tenants see
  // property-scoped items where they have an active tenancy on that property
  // (`compliance_items_select_tenant_property`), so a single query is enough.
  const propertyIds = Array.from(
    new Set(list.map((t) => t.property_id).filter((id): id is string => !!id)),
  );
  const { data: complianceRows } = propertyIds.length
    ? await supabase
        .from('compliance_items')
        .select('id, property_id, type, status, expires_at')
        .in('property_id', propertyIds)
    : { data: [] };

  const complianceByProperty = new Map<
    string,
    { id: string; type: ComplianceType; status: ComplianceStatus; expires_at: string | null }[]
  >();
  for (const row of complianceRows ?? []) {
    if (!row.property_id) continue;
    const bucket = complianceByProperty.get(row.property_id) ?? [];
    bucket.push({
      id: row.id,
      type: row.type as ComplianceType,
      status: row.status as ComplianceStatus,
      expires_at: row.expires_at,
    });
    complianceByProperty.set(row.property_id, bucket);
  }

  // Rent charges for the tenant's tenancies — RLS already restricts visibility
  // to their own tenancies via `rent_charges_select_tenant_self`.
  const tenancyIds = list.map((t) => t.id);
  const { data: chargeRows } = tenancyIds.length
    ? await supabase
        .from('rent_charges')
        .select('*')
        .in('tenancy_id', tenancyIds)
        .order('period_start', { ascending: false })
        .limit(50)
    : { data: [] };
  const chargesByTenancy = new Map<string, RentCharge[]>();
  for (const raw of chargeRows ?? []) {
    const c = RentCharge.parse(raw);
    const bucket = chargesByTenancy.get(c.tenancy_id) ?? [];
    bucket.push(c);
    chargesByTenancy.set(c.tenancy_id, bucket);
  }

  // Pending invites for this email — RLS lets the owner of the email view them
  // via the `tenancies_select_tenant_self` policy once they accept, but at the
  // pending stage we need a separate match on `invite_email`. The org members
  // already see them; tenants get to see their own via this lookup.
  const userEmail = (user.email ?? '').toLowerCase();
  const { data: pendingInvites } = userEmail
    ? await supabase
        .from('tenancies')
        .select(
          `id, invite_token, invite_expires_at, start_date, rent_pence, rent_frequency,
           properties:property_id ( name, address ),
           rooms:room_id ( name ),
           orgs:org_id ( name )`,
        )
        .eq('invite_email', userEmail)
        .eq('status', 'pending_invite')
        .order('created_at', { ascending: false })
    : { data: [] };

  const invites = pendingInvites ?? [];

  // Maintenance tickets — shown as a single summary card on the dashboard.
  // RLS scopes results to tenancies the user owns; if they have none, the
  // loader returns an empty array.
  const { tickets: maintenanceTickets } = await loadTenantTicketsBoard(user.id);

  // Open AST envelopes — one per tenancy. We hydrate the per-tenancy
  // card so the tenant sees the "Sign now" CTA inline.
  const envelopesByTenancy = new Map<string, AstEnvelope | null>();
  // Top-3 most recent shared bills per tenancy — surfaced inline so
  // the tenant doesn't need to click through to /tenant/bills for
  // their headline number.
  const billsByTenancy = new Map<string, TenantBillRow[]>();
  await Promise.all(
    list.map(async (t) => {
      try {
        envelopesByTenancy.set(t.id, await loadActiveEnvelopeForTenancy(t.id));
      } catch {
        envelopesByTenancy.set(t.id, null);
      }
      try {
        const all = await loadBillsForTenancy(t.id);
        billsByTenancy.set(t.id, all.slice(0, 3));
      } catch {
        billsByTenancy.set(t.id, []);
      }
    }),
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Your home</h1>
        <p className="text-sm text-muted-foreground">
          Tenantly is <span className="font-medium text-foreground">free for you, forever</span>.
          Track your rent, deposit and maintenance — all in one place.
        </p>
      </header>

      <Card className="border-teal-200 bg-teal-50/40 dark:bg-teal-500/5">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookUser className="h-4 w-4 text-teal-700 dark:text-teal-300" />
              Your Rental Passport
            </CardTitle>
            <CardDescription>
              A portable record of your tenancy history, payment record and verified identity. Yours
              to take with you.
            </CardDescription>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/tenant/passport">Open passport</Link>
          </Button>
        </CardHeader>
      </Card>

      {invites.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4 text-amber-600" />
              {invites.length === 1
                ? 'You have an invite waiting'
                : `${invites.length} invites waiting`}
            </CardTitle>
            <CardDescription>
              Review and accept your tenancy. Tenantly is free for tenants — forever.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.map((iv) => {
              const property = pickFirst<{
                name: string;
                address: { line1?: string; city?: string } | null;
              }>(iv.properties);
              const room = pickFirst<{ name: string }>(iv.rooms);
              const org = pickFirst<{ name: string }>(iv.orgs);
              return (
                <div
                  key={iv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {property?.name ?? 'Property'}
                      {room?.name ? (
                        <span className="text-muted-foreground"> — {room.name}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {org?.name ?? 'Landlord'} · move-in {iv.start_date} ·{' '}
                      {formatMoney(iv.rent_pence)} {iv.rent_frequency === 'weekly' ? 'pw' : 'pcm'}
                    </div>
                  </div>
                  {iv.invite_token ? (
                    <Button asChild size="sm">
                      <Link href={`/invite/${iv.invite_token}`}>Review &amp; accept</Link>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {list.length === 0 && invites.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title="No active tenancies yet"
          description="Browse rooms on the public listings page or ask your landlord to send you an invite — once they do, your home will appear here. Track every room you've applied for in your applications page."
          cta={{ label: 'Browse listings', href: '/listings' }}
        />
      ) : list.length === 0 ? null : (
        <ul className="grid grid-cols-1 gap-4">
          {list.map((t) => {
            const property = pickFirst<{
              name: string;
              address: { line1: string; city: string; postcode: string };
            }>(t.properties);
            const room = pickFirst<{ name: string }>(t.rooms);
            const status = STATUS_LABEL[t.status] ?? FALLBACK_STATUS;

            return (
              <li key={t.id}>
                <Card>
                  <CardHeader className="space-y-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      {property?.name ?? 'Your home'}
                      {room?.name ? (
                        <span className="text-muted-foreground">— {room.name}</span>
                      ) : null}
                      <Badge className={status.tone}>{status.label}</Badge>
                    </CardTitle>
                    {property?.address ? (
                      <CardDescription>
                        {property.address.line1} · {property.address.city} ·{' '}
                        {property.address.postcode}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Rent</div>
                        <div className="mt-1 text-lg font-semibold">
                          {formatMoney(t.rent_pence)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            {t.rent_frequency === 'weekly' ? 'pw' : 'pcm'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Due day {t.rent_due_day}
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Deposit</div>
                        <div className="mt-1 text-lg font-semibold">
                          {formatMoney(t.deposit_pence)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.deposit_protected_at
                            ? `Protected · ${t.deposit_scheme?.toUpperCase() ?? ''}`
                            : 'Awaiting protection'}
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Tenancy</div>
                        <div className="mt-1 text-sm font-medium">{t.start_date}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.end_date ? `to ${t.end_date}` : 'Periodic — no end date'}
                        </div>
                      </div>
                    </div>
                    <AstStatusCard
                      tenancyId={t.id}
                      envelope={envelopesByTenancy.get(t.id) ?? null}
                      viewer="tenant"
                    />
                    <TenantRentSummary
                      tenancyId={t.id}
                      charges={chargesByTenancy.get(t.id) ?? []}
                    />
                    <TenantBillsCard bills={billsByTenancy.get(t.id) ?? []} />
                    <TenantComplianceSummary
                      items={t.property_id ? (complianceByProperty.get(t.property_id) ?? []) : []}
                    />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {list.length > 0 ? (
        <TenantMaintenanceSummary tickets={maintenanceTickets} hasActiveTenancy={list.length > 0} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Coming soon
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pay rent in-app, manage your deposit and view your{' '}
          <Building2 className="-mt-0.5 inline h-3.5 w-3.5" /> Rental Passport.{' '}
          <Link href="/account" className="font-medium text-primary hover:underline">
            Update your profile
          </Link>{' '}
          to be ready when these land.
        </CardContent>
      </Card>
    </div>
  );
}
