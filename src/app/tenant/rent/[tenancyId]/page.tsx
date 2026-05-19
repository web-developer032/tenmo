import { ArrowLeft, MessageSquare, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/core/utils/money';
import { groupChargesByTime } from '@/core/utils/rent-rules';
import { TenancyDocumentsCard } from '@/features/documents/components/tenancy-documents-card';
import { resolveTenancyConversationId } from '@/features/messaging/server';
import { MandateStatusCard } from '@/features/payments/components/mandate-status-card';
import { loadActiveMandateForTenancy } from '@/features/payments/loaders';
import { ChargeRow } from '@/features/rent/components/charge-row';
import { PaymentRow } from '@/features/rent/components/payment-row';
import { loadTenancyRent } from '@/features/rent/loaders';
import { createClient } from '@/lib/supabase/server';

type Params = { tenancyId: string };

export const dynamic = 'force-dynamic';

/**
 * Tenant rent ledger — read-only mirror of the landlord's view.
 *
 * RLS guarantees a tenant can only ever load `rent_charges` and `rent_payments`
 * for tenancies they're attached to (via `tenant_user_id`), so the loader is
 * the same as the landlord page. We additionally double-check that the
 * tenancy belongs to this user before rendering, to fail closed on any RLS
 * misconfiguration.
 */
export default async function TenantRentLedgerPage({ params }: { params: Promise<Params> }) {
  const { tenancyId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/tenant/rent/${tenancyId}`);

  const { data: tenancy, error: tenancyErr } = await supabase
    .from('tenancies')
    .select(
      `id, tenant_user_id, rent_pence, rent_frequency,
       properties:property_id ( name ),
       rooms:room_id ( name )`,
    )
    .eq('id', tenancyId)
    .maybeSingle();
  if (tenancyErr) throw tenancyErr;
  if (!tenancy || tenancy.tenant_user_id !== user.id) notFound();

  const property = pickFirst<{ name: string }>(tenancy.properties);
  const room = pickFirst<{ name: string }>(tenancy.rooms);

  const detail = await loadTenancyRent(tenancyId);
  const grouped = groupChargesByTime(detail.charges);
  const conversationId = await resolveTenancyConversationId(tenancyId);
  const mandate = await loadActiveMandateForTenancy(tenancyId);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tenant">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to your home
          </Link>
        </Button>
        {conversationId ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/messages/${conversationId}`}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Message landlord
            </Link>
          </Button>
        ) : null}
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Your rent</h1>
        <p className="text-sm text-muted-foreground">
          {property?.name ?? 'Your home'}
          {room?.name ? ` — ${room.name}` : ''} · {formatMoney(tenancy.rent_pence)}{' '}
          {tenancy.rent_frequency === 'weekly' ? 'pw' : 'pcm'}
        </p>
      </header>

      <MandateStatusCard tenancyId={tenancyId} mandate={mandate} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat
          label={detail.arrearsPence > 0 ? 'Outstanding' : 'Up to date'}
          value={formatMoney(detail.arrearsPence)}
          tone={detail.arrearsPence > 0 ? 'text-alert' : 'text-forest-600'}
        />
        <Stat label="Open charges" value={String(grouped.overdue.length + grouped.due.length)} />
        <Stat
          label="Recorded payments"
          value={String(detail.payments.length)}
          subtle="kept for your records"
        />
      </div>

      {grouped.overdue.length > 0 ? (
        <Section
          title="Overdue"
          subtitle="Past their due date — please pay these as soon as possible."
          tone="border-alert/30"
        >
          {grouped.overdue.map((c) => (
            <ChargeRow key={c.id} charge={c} />
          ))}
        </Section>
      ) : null}

      {grouped.due.length > 0 ? (
        <Section
          title="Due now"
          subtitle="Currently due. Pay using the method your landlord has set up."
          tone="border-amber/30"
        >
          {grouped.due.map((c) => (
            <ChargeRow key={c.id} charge={c} />
          ))}
        </Section>
      ) : null}

      {grouped.upcoming.length > 0 ? (
        <Section title="Upcoming" subtitle="Scheduled — these are your future charges.">
          {grouped.upcoming.map((c) => (
            <ChargeRow key={c.id} charge={c} />
          ))}
        </Section>
      ) : null}

      {grouped.paid.length > 0 ? (
        <Section title="Paid" subtitle="Your payment history.">
          {grouped.paid.slice(0, 12).map((c) => (
            <ChargeRow key={c.id} charge={c} />
          ))}
        </Section>
      ) : null}

      {detail.charges.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Wallet className="mx-auto mb-2 h-6 w-6" />
            No rent activity yet. Your landlord hasn&apos;t issued any charges — they&apos;ll appear
            here automatically.
          </CardContent>
        </Card>
      ) : null}

      {detail.payments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
            <CardDescription>
              Recorded by your landlord (or via Tenantly when you start paying in-app).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.payments.slice(0, 25).map((p) => {
              const payment = {
                id: p.id,
                amount_pence: p.amount_pence,
                method: p.method as Parameters<typeof PaymentRow>[0]['payment']['method'],
                status: p.status as Parameters<typeof PaymentRow>[0]['payment']['status'],
                paid_at: p.paid_at,
                notes: p.notes,
              };
              return <PaymentRow key={p.id} payment={payment} />;
            })}
          </CardContent>
        </Card>
      ) : null}

      <TenancyDocumentsCard tenancyId={tenancyId} actorRole="tenant" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenantly is free for you, forever</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          We never charge tenants a platform fee. The rent shown here is exactly what your landlord
          agreed with you — nothing on top.
        </CardContent>
      </Card>
    </div>
  );
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function Section({
  title,
  subtitle,
  tone,
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={tone}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
  subtle,
}: {
  label: string;
  value: string;
  tone?: string;
  subtle?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold ${tone ?? ''}`}>{value}</div>
        {subtle ? <div className="text-xs text-muted-foreground">{subtle}</div> : null}
      </CardContent>
    </Card>
  );
}
