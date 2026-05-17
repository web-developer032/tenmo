import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplianceType } from '@/core/constants/compliance';
import { ComplianceForm } from '@/features/compliance/components/compliance-form';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };
type Search = { property_id?: string; type?: string };

export default async function NewCompliancePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('properties')
    .select('id, name')
    .eq('org_id', org.id)
    .is('archived_at', null)
    .order('name');
  if (error) throw error;

  const properties = (data ?? []).map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <Link
          href={`/landlord/${slug}/compliance`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to compliance
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a certificate</CardTitle>
          <CardDescription>
            Tenantly will set up reminders automatically and surface this in your traffic-light
            dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ComplianceForm
            orgId={org.id}
            orgSlug={slug}
            properties={properties}
            defaultPropertyId={search.property_id}
            defaultType={search.type as ComplianceType | undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
