import { ArrowLeft, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/core/utils/money';
import { canCollect } from '@/core/utils/payment-rules';
import { chargeOutstandingPence, groupChargesByTime } from '@/core/utils/rent-rules';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { CollectNowButton } from '@/features/payments/components/collect-now-button';
import { MandateStatusBadge } from '@/features/payments/components/mandate-status-badge';
import { loadActiveMandateForTenancy } from '@/features/payments/loaders';
import { ChargeRow } from '@/features/rent/components/charge-row';
import { PaymentRow } from '@/features/rent/components/payment-row';
import {
  type ChargeOption,
  RecordPaymentDialog,
} from '@/features/rent/components/record-payment-dialog';
import { loadTenancyRent } from '@/features/rent/loaders';
import { loadTenancy } from '@/features/tenancies/loaders';

type Params = { slug: string; tenancyId: string };

export const dynamic = 'force-dynamic';

/**
 * Per-tenancy rent ledger.
 *
 * Top: tenancy header + arrears summary + "Record payment".
 * Body: open charges (overdue → due → upcoming), then paid history,
 *       then payment events in chronological order.
 */
export default async function TenancyRentLedgerPage({ params }: { params: Promise<Params> }) {
  const { slug, tenancyId } = await params;
  const [org, tenancy] = await Promise.all([resolveOrgBySlug(slug), loadTenancy(tenancyId)]);
  if (!org || !tenancy || tenancy.org_id !== org.id) notFound();

  const detail = await loadTenancyRent(tenancyId);
  const grouped = groupChargesByTime(detail.charges);
  const mandate = await loadActiveMandateForTenancy(tenancyId);
  const collectable = canCollect(mandate);

  const chargeOptions: ChargeOption[] = [
    ...grouped.overdue,
    ...grouped.due,
    ...grouped.upcoming,
  ].map((c) => ({
    id: c.id,
    label: `${c.due_date} — ${formatMoney(chargeOutstandingPence(c))} outstanding`,
    outstandingPence: chargeOutstandingPence(c),
  }));

  const oldestOpen = chargeOptions[0];
  const defaultAmount = oldestOpen?.outstandingPence ?? tenancy.rent_pence;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/landlord/${slug}/tenancies/${tenancyId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to tenancy
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Rent ledger</h1>
          <p className="text-sm text-muted-foreground">
            {tenancy.property_name}
            {tenancy.room_name ? ` — ${tenancy.room_name}` : ''} · {formatMoney(tenancy.rent_pence)}{' '}
            {tenancy.rent_frequency === 'weekly' ? '/wk' : '/mo'}
          </p>
        </div>
        <RecordPaymentDialog
          tenancyId={tenancyId}
          defaultAmountPence={defaultAmount}
          charges={chargeOptions}
        />
      </header>

      {mandate ? (
        <Card className={collectable ? 'border-forest-200' : 'border-amber/40'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Direct Debit <MandateStatusBadge status={mandate.status} />
            </CardTitle>
            <CardDescription>
              {collectable
                ? 'You can collect any open charge with one click. The cron also pulls due rent automatically.'
                : 'Mandate is not yet active — the tenant has been redirected to GoCardless. We will collect once their bank confirms.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">No Direct Debit yet</CardTitle>
            <CardDescription>
              The tenant hasn&apos;t set up a Direct Debit. They can do it from their rent page.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat
          label="Arrears"
          value={formatMoney(detail.arrearsPence)}
          tone={detail.arrearsPence > 0 ? 'text-alert' : 'text-forest-600'}
        />
        <Stat label="Open charges" value={String(grouped.overdue.length + grouped.due.length)} />
        <Stat label="Total recorded" value={String(detail.payments.length)} subtle="payments" />
      </div>

      {grouped.overdue.length > 0 ? (
        <Section
          title="Overdue"
          subtitle="Past their due date and unpaid (or partly paid)."
          tone="border-alert/30"
        >
          {grouped.overdue.map((c) => (
            <ChargeRow
              key={c.id}
              charge={c}
              actions={collectable ? <CollectNowButton chargeId={c.id} /> : null}
            />
          ))}
        </Section>
      ) : null}

      {grouped.due.length > 0 ? (
        <Section
          title="Due now"
          subtitle="Currently due — the tenant should pay any day now."
          tone="border-amber/30"
        >
          {grouped.due.map((c) => (
            <ChargeRow
              key={c.id}
              charge={c}
              actions={collectable ? <CollectNowButton chargeId={c.id} /> : null}
            />
          ))}
        </Section>
      ) : null}

      {grouped.upcoming.length > 0 ? (
        <Section
          title="Upcoming"
          subtitle="Scheduled by the rent cron — visible to the tenant for transparency."
        >
          {grouped.upcoming.map((c) => (
            <ChargeRow key={c.id} charge={c} />
          ))}
        </Section>
      ) : null}

      {grouped.paid.length > 0 ? (
        <Section title="Paid" subtitle="History — kept indefinitely for auditing.">
          {grouped.paid.slice(0, 12).map((c) => (
            <ChargeRow key={c.id} charge={c} />
          ))}
        </Section>
      ) : null}

      {detail.charges.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Wallet className="mx-auto mb-2 h-6 w-6" />
            No charges yet. The rent cron creates them automatically a few days before each period
            starts; you can also record manual payments here once you start collecting.
          </CardContent>
        </Card>
      ) : null}

      {detail.payments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
            <CardDescription>
              Manual entries and (later) GoCardless / Open Banking events.
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
    </div>
  );
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
  // Promote a child charge's status to inform the section tint.
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
