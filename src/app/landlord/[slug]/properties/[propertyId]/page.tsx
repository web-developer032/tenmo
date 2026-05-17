import { ArrowLeft, DoorOpen, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BillsList } from '@/features/bills/components/bills-list';
import { loadBillsForProperty } from '@/features/bills/loaders';
import { PropertyComplianceSection } from '@/features/compliance/components/property-compliance-section';
import { loadPropertyCompliance } from '@/features/compliance/loaders';
import { PropertyDocumentsCard } from '@/features/documents/components/property-documents-card';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string; propertyId: string };

const STATUS_TONE: Record<string, string> = {
  available: 'bg-muted text-muted-foreground',
  occupied: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  reserved: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  maintenance: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  archived: 'bg-muted text-muted-foreground',
};

export default async function PropertyDetailPage({ params }: { params: Promise<Params> }) {
  const { slug, propertyId } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase.from('orgs').select('id').eq('slug', slug).maybeSingle();
  if (!org) notFound();

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .eq('org_id', org.id)
    .maybeSingle();
  if (!property) notFound();

  const [{ data: rooms }, compliance, bills] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, name, status, default_rent_pence, has_ensuite')
      .eq('property_id', property.id)
      .is('archived_at', null)
      .order('name'),
    loadPropertyCompliance(property.id),
    loadBillsForProperty(property.id),
  ]);

  const list = rooms ?? [];
  const addr = property.address as {
    line1: string;
    line2?: string | null;
    city: string;
    postcode: string;
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <Link
        href={`/landlord/${slug}/properties`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to properties
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{property.name}</h1>
            {property.is_hmo ? <Badge variant="secondary">HMO</Badge> : null}
            {property.hmo_licence_required ? (
              <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/15">
                Licence required
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ''} · {addr.city} · {addr.postcode}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/landlord/${slug}/properties/${property.id}/rooms/new`}>
              <Plus className="mr-1 h-4 w-4" /> Add room
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/landlord/${slug}/properties/${property.id}/tenancies/new`}>
              <DoorOpen className="mr-1 h-4 w-4" /> Invite tenant
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {list.length === 0 ? (
          <EmptyState
            icon={<DoorOpen className="h-6 w-6" />}
            title="No rooms yet"
            description="Add a room to start tracking occupancy, rent and compliance for this property."
            cta={{
              label: 'Add a room',
              href: `/landlord/${slug}/properties/${property.id}/rooms/new`,
            }}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>Rooms ({list.length})</span>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/landlord/${slug}/listings`}>Manage listings</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {list.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${
                          STATUS_TONE[r.status] ?? STATUS_TONE.available
                        }`}
                      >
                        {r.status}
                      </span>
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.has_ensuite ? 'En-suite' : 'Shared bath'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>
                        {r.default_rent_pence != null
                          ? `£${(r.default_rent_pence / 100).toFixed(0)} pcm`
                          : '—'}
                      </span>
                      <Link
                        href={`/landlord/${slug}/listings`}
                        className="text-xs text-primary underline"
                      >
                        List
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <PropertyComplianceSection
          orgId={org.id}
          orgSlug={slug}
          propertyId={property.id}
          data={compliance}
        />
      </div>

      <BillsList
        propertyId={property.id}
        bills={bills}
        rooms={list.map((r) => ({ id: r.id, name: r.name }))}
      />

      <PropertyDocumentsCard propertyId={property.id} />
    </div>
  );
}
