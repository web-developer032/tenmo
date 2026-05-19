import { Building2, MapPin, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };

export default async function PropertiesListPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase.from('orgs').select('id').eq('slug', slug).maybeSingle();
  if (!org) notFound();

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, type, address, total_rooms, is_hmo')
    .eq('org_id', org.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const list = properties ?? [];

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Properties' },
        ]}
        title="Properties"
        description="Buildings under management. Add rooms to start tracking tenancies and compliance."
        actions={
          <Button asChild>
            <Link href={`/landlord/${slug}/properties/new`}>
              <Plus className="h-4 w-4" /> Add property
            </Link>
          </Button>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No properties yet"
          description="Add your first property to start tracking rooms, tenancies and compliance."
          cta={{ label: 'Add property', href: `/landlord/${slug}/properties/new` }}
        />
      ) : (
        <ResponsiveGrid preset="cards-3">
          {list.map((p) => {
            const addr = p.address as { line1: string; city: string; postcode: string };
            return (
              <Link key={p.id} href={`/landlord/${slug}/properties/${p.id}`} className="block">
                <Card className="h-full transition-colors hover:border-forest-200 hover:bg-foam/40">
                  <CardHeader>
                    <CardTitle className="text-[14px]">{p.name}</CardTitle>
                    {p.is_hmo ? <Badge variant="active">HMO</Badge> : null}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-start gap-1.5 text-[12.5px] text-ink-mid">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-light" />
                      <span>
                        {addr.line1}
                        <br />
                        {addr.city} · {addr.postcode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border-soft pt-2 text-[12px] text-ink-light">
                      <span className="font-medium text-ink-mid">
                        {p.total_rooms ?? 0} {p.total_rooms === 1 ? 'room' : 'rooms'}
                      </span>
                      <span>{p.type.replace('_', ' ')}</span>
                    </div>
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
