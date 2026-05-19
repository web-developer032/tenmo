import { Building2, DoorOpen } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };

/**
 * Property picker for "Start a tenancy".
 *
 * Tenancies always live under a specific property + room
 * (the real invite form is at `properties/[propertyId]/tenancies/new`).
 * This page lists every property in the org with its room count so the
 * landlord can drill down. It also catches anyone who lands directly on
 * `/landlord/[slug]/tenancies/new` (previously a 500 because Next was
 * matching that path against `[tenancyId]/page.tsx` and passing "new" as
 * a UUID to the loader).
 */
export default async function StartTenancyPickerPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, address, rooms:rooms(id, name, status)')
    .eq('org_id', org.id)
    .order('name');

  const list = properties ?? [];

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Tenancies', href: `/landlord/${slug}/tenancies` },
          { label: 'Start a tenancy' },
        ]}
        title="Start a tenancy"
        description="Choose the property — we'll let you pick a room and send the tenant invite from there."
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No properties yet"
          description="Add your first property and at least one room before inviting a tenant."
          cta={{ label: 'Add a property', href: `/landlord/${slug}/properties/new` }}
        />
      ) : (
        <ResponsiveGrid preset="cards-2">
          {list.map((p) => {
            const rooms = (p.rooms ?? []) as Array<{ id: string; name: string; status: string }>;
            return (
              <Link
                key={p.id}
                href={`/landlord/${slug}/properties/${p.id}/tenancies/new`}
                className="group"
              >
                <Card className="h-full transition-colors hover:border-forest-200 hover:bg-foam/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-forest-600" /> {p.name}
                    </CardTitle>
                    <span className="text-[12.5px] font-semibold text-forest-600 group-hover:underline">
                      Choose room
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-[13px]">
                    {p.address ? (
                      <p className="text-ink-light">{p.address as unknown as string}</p>
                    ) : null}
                    <p className="inline-flex items-center gap-1.5 text-ink-mid">
                      <DoorOpen className="h-3.5 w-3.5 text-ink-light" />
                      {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </ResponsiveGrid>
      )}
    </div>
  );
}
