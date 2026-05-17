import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplianceType } from '@/core/constants/compliance';
import { ComplianceEditForm } from '@/features/compliance/components/compliance-edit-form';
import { ComplianceStatusBadge } from '@/features/compliance/components/compliance-status-badge';
import { complianceTypeLabel } from '@/features/compliance/status-display';
import { ComplianceDocumentsCard } from '@/features/documents/components/compliance-documents-card';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string; itemId: string };

export default async function ComplianceItemPage({ params }: { params: Promise<Params> }) {
  const { slug, itemId } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('compliance_items')
    .select('*, properties:property_id (name)')
    .eq('id', itemId)
    .eq('org_id', org.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) notFound();

  const propertyName = pickFirst<{ name: string }>(data.properties)?.name ?? 'Property';

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
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              {complianceTypeLabel(data.type as ComplianceType)}
            </CardTitle>
            <CardDescription>{propertyName}</CardDescription>
          </div>
          <ComplianceStatusBadge
            status={data.status as 'ok' | 'due_soon' | 'overdue' | 'unknown'}
          />
        </CardHeader>
        <CardContent>
          <ComplianceEditForm
            orgSlug={slug}
            item={{
              id: data.id,
              type: data.type as ComplianceType,
              issued_at: data.issued_at,
              expires_at: data.expires_at,
              notes: data.notes,
            }}
          />
        </CardContent>
      </Card>

      <ComplianceDocumentsCard complianceItemId={data.id} />
    </div>
  );
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
