import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PropertyForm } from '@/features/properties/components/property-form';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };

export default async function NewPropertyPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('orgs')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!org) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <Link
        href={`/landlord/${slug}/properties`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to properties
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add a property</CardTitle>
          <CardDescription>
            Add the building first; you&apos;ll add rooms inside it next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertyForm orgId={org.id} orgSlug={org.slug} />
        </CardContent>
      </Card>
    </div>
  );
}
