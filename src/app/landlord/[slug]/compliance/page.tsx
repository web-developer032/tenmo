import { AlertTriangle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
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
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Compliance' },
        ]}
        title="Compliance"
        description="Track every certificate, licence and risk assessment for your portfolio. Tenantly reminds you before things expire — no spreadsheets, no surprises."
        actions={
          <Button asChild>
            <Link href={`/landlord/${slug}/compliance/new`}>Add a certificate</Link>
          </Button>
        }
      />

      <Card className="overflow-hidden border-forest-200 bg-gradient-to-br from-forest-100/60 via-white to-white">
        <CardHeader className="items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-forest-600" />
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
              tone={flatGroups.overdue.length > 0 ? 'text-alert' : ''}
            />
            <Stat
              label="Due soon"
              value={flatGroups.due_soon.length}
              tone={flatGroups.due_soon.length > 0 ? 'text-amber' : ''}
            />
          </dl>
        </CardContent>
      </Card>

      {urgent.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-light">
            <AlertTriangle className="h-4 w-4 text-amber" />
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
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-light">Properties</h2>
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
      <dt className="text-[11px] uppercase tracking-wide text-ink-light">{label}</dt>
      <dd className={`font-sans text-xl font-bold text-ink ${tone ?? ''}`}>{value}</dd>
    </div>
  );
}
