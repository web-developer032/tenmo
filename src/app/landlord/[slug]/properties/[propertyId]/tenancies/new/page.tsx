import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { InviteForm, type RoomOption } from '@/features/tenancies/components/invite-form';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string; propertyId: string };

export default async function NewTenancyPage({ params }: { params: Promise<Params> }) {
  const { slug, propertyId } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const { data: property, error } = await supabase
    .from('properties')
    .select('id, name, address')
    .eq('id', propertyId)
    .eq('org_id', org.id)
    .maybeSingle();

  if (error || !property) notFound();

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, default_rent_pence, default_rent_frequency, status')
    .eq('property_id', propertyId)
    .order('name');

  const roomOptions: RoomOption[] = (rooms ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    default_rent_pence: r.default_rent_pence ?? null,
    default_rent_frequency: (r.default_rent_frequency ?? 'monthly') as 'monthly' | 'weekly',
    status: r.status as RoomOption['status'],
  }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/landlord/${slug}/properties/${propertyId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to property
          </Link>
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Invite a tenant — {property.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email a free, fee-less invite.{' '}
          <strong>Tenants are never charged on Tenantly.</strong>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Tenancy terms</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm orgId={org.id} orgSlug={slug} propertyId={propertyId} rooms={roomOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
