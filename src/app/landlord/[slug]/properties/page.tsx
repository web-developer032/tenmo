import { Building2, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
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
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Properties</h1>
          <p className="text-sm text-muted-foreground">
            Buildings under management. Add rooms to start tracking tenancies and compliance.
          </p>
        </div>
        <Button asChild>
          <Link href={`/landlord/${slug}/properties/new`}>
            <Plus className="mr-1 h-4 w-4" /> Add property
          </Link>
        </Button>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No properties yet"
          description="Add your first property to start tracking rooms, tenancies and compliance."
          cta={{ label: 'Add property', href: `/landlord/${slug}/properties/new` }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const addr = p.address as { line1: string; city: string; postcode: string };
            return (
              <li key={p.id}>
                <Link href={`/landlord/${slug}/properties/${p.id}`} className="block">
                  <Card className="h-full transition-colors hover:border-primary/50">
                    <CardHeader>
                      <CardTitle className="flex items-start justify-between gap-2 text-base">
                        <span>{p.name}</span>
                        {p.is_hmo ? <Badge variant="secondary">HMO</Badge> : null}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm text-muted-foreground">
                      <div>{addr.line1}</div>
                      <div>
                        {addr.city} · {addr.postcode}
                      </div>
                      <div className="pt-2 text-xs">
                        {p.total_rooms ?? 0} {p.total_rooms === 1 ? 'room' : 'rooms'} ·{' '}
                        {p.type.replace('_', ' ')}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
