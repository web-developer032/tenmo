import {
  ArrowRight,
  Building2,
  DoorOpen,
  Home,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { KpiCard } from '@/components/ds/kpi-card';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadLandlordStats } from '@/features/landlord-dashboard/loader';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };

export default async function LandlordDashboardPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('orgs')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!org) notFound();

  const stats = await loadLandlordStats(org.id);
  const occupancyRate =
    stats.roomsCount === 0 ? 0 : Math.round((stats.occupiedRoomsCount / stats.roomsCount) * 100);

  const isEmpty = stats.propertiesCount === 0;

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Tenantly', href: '/dispatch' }, { label: org.name ?? slug }]}
        title={`Welcome back · ${org.name ?? 'your portfolio'}`}
        description="Your portfolio at a glance — properties, rooms, rent and compliance."
        actions={
          <Button asChild>
            <Link href={`/landlord/${slug}/properties/new`}>Add property</Link>
          </Button>
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Add your first property"
          description="Tenantly is built around rooms as first-class entities. Add a property, then add the rooms inside it. We'll set up the right HMO compliance schedule automatically."
          cta={{ label: 'Add a property', href: `/landlord/${slug}/properties/new` }}
        />
      ) : (
        <>
          <ResponsiveGrid preset="kpi" aria-label="Overview metrics">
            <KpiCard
              label="Properties"
              value={stats.propertiesCount}
              icon={<Building2 />}
              accent="forest"
              sublabel="Buildings under management"
            />
            <KpiCard
              label="Rooms"
              value={stats.roomsCount}
              icon={<DoorOpen />}
              accent="forest"
              sublabel={`${stats.occupiedRoomsCount} occupied · ${occupancyRate}%`}
            />
            <KpiCard
              label="Active tenancies"
              value={stats.activeTenanciesCount}
              icon={<Users />}
              accent="blue"
              sublabel="Current contracts in flight"
            />
            <KpiCard
              label="Compliance overdue"
              value={stats.complianceRedCount}
              icon={<ShieldAlert />}
              accent={stats.complianceRedCount > 0 ? 'red' : 'forest'}
              sublabel="Items past renewal"
            />
          </ResponsiveGrid>

          <ResponsiveGrid preset="kpi" className="lg:grid-cols-2">
            <KpiCard
              label="Compliance · 30-day"
              value={stats.complianceAmberCount}
              icon={<ShieldCheck />}
              accent={stats.complianceAmberCount > 0 ? 'amber' : 'forest'}
              sublabel="Renewals due in the next 30 days"
            />
            <KpiCard
              label="Occupancy"
              value={`${occupancyRate}%`}
              icon={<Home />}
              accent="forest"
              sublabel="Rooms currently let"
            />
          </ResponsiveGrid>

          <ResponsiveGrid preset="dash-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <Link
                  href={`/landlord/${slug}/finance`}
                  className="text-[12.5px] font-semibold text-forest-600 hover:underline"
                >
                  View ledger
                </Link>
              </CardHeader>
              <CardContent className="text-sm text-ink-light">
                Activity feed coming soon. We&apos;ll surface rent receipts, new tenancies and
                compliance reminders here.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>What to do next</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <NextAction
                  href={`/landlord/${slug}/properties/new`}
                  title="Add another property"
                  description="Or import in bulk from a CSV (coming in MVP+1)."
                />
                <NextAction
                  href={`/landlord/${slug}/tenancies/new`}
                  title="Start a tenancy"
                  description="Create the room first, then invite a tenant by email."
                />
                <NextAction
                  href={`/landlord/${slug}/compliance`}
                  title="Review compliance"
                  description="Make sure gas, electrical, EPC and licensing are all green."
                />
              </CardContent>
            </Card>
          </ResponsiveGrid>
        </>
      )}
    </div>
  );
}

function NextAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-3 rounded-button border border-border-soft bg-white p-3 transition-colors hover:border-forest-200 hover:bg-foam/60"
    >
      <span className="min-w-0">
        <span className="block font-sans text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="block text-[12.5px] text-ink-light">{description}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-light transition-transform group-hover:translate-x-0.5 group-hover:text-forest-600" />
    </Link>
  );
}
