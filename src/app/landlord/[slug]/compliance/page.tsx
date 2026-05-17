import { AlertTriangle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComplianceItemRow } from '@/features/compliance/components/compliance-item-row';
import { PropertyComplianceCard } from '@/features/compliance/components/property-compliance-card';
import { ScorePill } from '@/features/compliance/components/score-pill';
import { loadOrgComplianceOverview } from '@/features/compliance/loaders';
import { resolveOrgBySlug } from '@/features/orgs/resolve';

type Params = { slug: string };

export const dynamic = 'force-dynamic';

/**
 * Landlord compliance dashboard.
 *
 * Layout:
 *   [ Hero: org-level score + counts ]
 *   [ Most urgent items (overdue + due soon, up to 8) ]
 *   [ Per-property cards ]
 *
 * Tenants never see this page — RLS scopes data to org members.
 */
export default async function ComplianceDashboardPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const { perProperty, flatGroups, orgScore } = await loadOrgComplianceOverview(org.id);
  const urgent = [...flatGroups.overdue, ...flatGroups.due_soon].slice(0, 8);
  const totalItems = perProperty.reduce((n, p) => n + p.items.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Compliance</h1>
          <p className="text-sm text-muted-foreground">
            Track every certificate, licence and risk assessment for your portfolio. Tenantly
            reminds you before things expire — no spreadsheets, no surprises.
          </p>
        </div>
        <Button asChild>
          <Link href={`/landlord/${slug}/compliance/new`}>Add a certificate</Link>
        </Button>
      </header>

      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              Portfolio compliance score
            </CardTitle>
            <CardDescription>
              Weighted across all certificates. 100% means you&apos;re fully covered.
            </CardDescription>
          </div>
          <ScorePill score={orgScore} size="lg" />
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Stat label="Properties" value={perProperty.length} />
            <Stat label="Items tracked" value={totalItems} />
            <Stat
              label="Overdue"
              value={flatGroups.overdue.length}
              tone={flatGroups.overdue.length > 0 ? 'text-red-700 dark:text-red-300' : ''}
            />
            <Stat
              label="Due soon"
              value={flatGroups.due_soon.length}
              tone={flatGroups.due_soon.length > 0 ? 'text-amber-700 dark:text-amber-300' : ''}
            />
          </dl>
        </CardContent>
      </Card>

      {urgent.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Needs attention
          </h2>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {urgent.map((item) => (
              <li key={item.id}>
                <ComplianceItemRow
                  item={item}
                  editHref={`/landlord/${slug}/compliance/${item.id}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Properties
        </h2>
        {perProperty.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="No properties to track yet"
            description="Add a property to start tracking its compliance certificates."
            cta={{ label: 'Add a property', href: `/landlord/${slug}/properties/new` }}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {perProperty.map((summary) => (
              <li key={summary.property.id}>
                <PropertyComplianceCard slug={slug} summary={summary} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-xl font-semibold ${tone ?? ''}`}>{value}</dd>
    </div>
  );
}
