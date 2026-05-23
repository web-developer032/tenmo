import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { Button } from '@/components/ui/button';
import { CHOOSABLE_TENANCY_STATUSES } from '@/core/utils/tenancy-chooser';
import { TenancyDocumentsCard } from '@/features/documents/components/tenancy-documents-card';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * `/tenant/documents` — aggregated documents across all of the caller's
 * tenancies. Each tenancy renders a `TenancyDocumentsCard` in
 * read-only mode (uploads are landlord-side; we set `actorRole="tenant"`).
 *
 * Categories visible to tenants are filtered server-side via RLS
 * (`documents_select_tenant_self` masks `category = 'identity'` rows so
 * Right-to-Rent ID copies stay landlord-only).
 */
export default async function TenantDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant/documents');

  const { data: rows } = await supabase
    .from('tenancies')
    .select(
      `id, status, start_date,
       properties:property_id ( name ),
       rooms:room_id ( name )`,
    )
    .eq('tenant_user_id', user.id)
    .in('status', CHOOSABLE_TENANCY_STATUSES as unknown as string[])
    .order('start_date', { ascending: false });

  const tenancies = rows ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Tenant', href: '/tenant' }, { label: 'Documents' }]}
        title={
          <span className="inline-flex items-center gap-2">
            <FileText className="h-5 w-5 text-forest-600" />
            Your documents
          </span>
        }
        description="AST, prescribed information, inventory and any other files your landlord has shared with you. Grouped by tenancy."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/tenant">
              <ArrowLeft className="h-4 w-4" /> Back to your home
            </Link>
          </Button>
        }
      />

      {tenancies.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No documents yet"
          description="Once you have a live tenancy, your AST and other paperwork will appear here."
          cta={{ label: 'Browse listings', href: '/listings' }}
        />
      ) : (
        tenancies.map((t) => {
          const property = pickFirst<{ name: string }>(t.properties);
          const room = pickFirst<{ name: string }>(t.rooms);
          const heading = [property?.name ?? 'Property', room?.name]
            .filter(Boolean)
            .join(' — ');
          return (
            <section key={t.id} className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-light">
                {heading}
              </h2>
              <TenancyDocumentsCard tenancyId={t.id} actorRole="tenant" />
            </section>
          );
        })
      )}
    </div>
  );
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
