import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RoomForm } from '@/features/rooms/components/room-form';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string; propertyId: string };

export default async function NewRoomPage({ params }: { params: Promise<Params> }) {
  const { slug, propertyId } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase.from('orgs').select('id').eq('slug', slug).maybeSingle();
  if (!org) notFound();

  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .eq('org_id', org.id)
    .maybeSingle();
  if (!property) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <Link
        href={`/landlord/${slug}/properties/${property.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to {property.name}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add a room</CardTitle>
          <CardDescription>
            Each room is its own lettable unit with its own rent and tenancies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoomForm orgSlug={slug} propertyId={property.id} />
        </CardContent>
      </Card>
    </div>
  );
}
