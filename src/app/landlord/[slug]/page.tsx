import { Building2, DoorOpen, Home, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/features/landlord-dashboard/components/stat-card';
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
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{org.name}</h1>
          <p className="text-sm text-muted-foreground">
            Your portfolio at a glance — property, rooms, rent and compliance.
          </p>
        </div>
        <Button asChild>
          <Link href={`/landlord/${slug}/properties/new`}>Add property</Link>
        </Button>
      </header>

      {isEmpty ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Add your first property"
          description="Tenantly is built around rooms as first-class entities. Add a property, then add the rooms inside it. We&apos;ll set up the right HMO compliance schedule automatically."
          cta={{ label: 'Add a property', href: `/landlord/${slug}/properties/new` }}
        />
      ) : (
        <>
          <section
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Overview metrics"
          >
            <StatCard
              label="Properties"
              value={stats.propertiesCount}
              hint="Buildings under management"
              icon={Building2}
            />
            <StatCard
              label="Rooms"
              value={stats.roomsCount}
              hint={`${stats.occupiedRoomsCount} occupied · ${occupancyRate}% occupancy`}
              icon={DoorOpen}
            />
            <StatCard
              label="Active tenancies"
              value={stats.activeTenanciesCount}
              hint="Current contracts in flight"
              icon={Users}
            />
            <StatCard
              label="Compliance: overdue"
              value={stats.complianceRedCount}
              hint="Items past their renewal date"
              icon={ShieldAlert}
              tone={stats.complianceRedCount > 0 ? 'danger' : 'default'}
            />
            <StatCard
              label="Compliance: 30-day"
              value={stats.complianceAmberCount}
              hint="Renewals due in the next 30 days"
              icon={ShieldCheck}
              tone={stats.complianceAmberCount > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Occupancy"
              value={`${occupancyRate}%`}
              hint="Rooms currently let"
              icon={Home}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Activity feed coming soon. We&apos;ll surface rent receipts, new tenancies, and
                compliance reminders here.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What to do next</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Link
                  href={`/landlord/${slug}/properties/new`}
                  className="block rounded-md border p-3 hover:bg-muted"
                >
                  <span className="font-medium">Add another property</span>
                  <span className="block text-muted-foreground">
                    Or import in bulk from a CSV (coming in MVP+1).
                  </span>
                </Link>
                <Link
                  href={`/landlord/${slug}/tenancies/new`}
                  className="block rounded-md border p-3 hover:bg-muted"
                >
                  <span className="font-medium">Start a tenancy</span>
                  <span className="block text-muted-foreground">
                    Create the room first, then attach a tenant by email invite.
                  </span>
                </Link>
                <Link
                  href={`/landlord/${slug}/compliance`}
                  className="block rounded-md border p-3 hover:bg-muted"
                >
                  <span className="font-medium">Review compliance</span>
                  <span className="block text-muted-foreground">
                    Make sure gas, electrical, EPC and licensing are all green.
                  </span>
                </Link>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
