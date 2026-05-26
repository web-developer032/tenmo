import { FileText } from 'lucide-react';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader, SectionCard, TabBar } from '@/components/ds';
import { DOCUMENT_CATEGORY_RULES, type DocumentCategory } from '@/core/constants/documents';
import { TenantDocRow } from '@/features/documents/components/tenant-doc-row';
import {
  complianceTypeLabel,
  loadTenantDocuments,
  type TenantDocumentRow,
  type TenantDocumentsBucket,
  type TenantDocumentsView,
} from '@/features/documents/server/load-tenant-documents';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TAB_TO_BUCKET: Record<string, TenantDocumentsBucket | 'all'> = {
  all: 'all',
  tenancy: 'tenancy',
  compliance: 'compliance',
  inventory: 'inventory',
};

/**
 * `/tenant/documents` — HMOeez redesign.
 *
 * Tabs (URL `?tab=`) filter the visible cards; data itself is loaded
 * once via `loadTenantDocuments`. The right-hand column always shows
 * the compliance + inventory cards because that's where the design
 * places them, but a category filter from the tabs hides cards whose
 * bucket doesn't match the active tab.
 */
export default async function TenantDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant/documents');

  const sp = (await searchParams) ?? {};
  const tab = TAB_TO_BUCKET[sp.tab ?? 'all'] ?? 'all';
  const view = await loadTenantDocuments(supabase, { userId: user.id });

  if (view.rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader
          breadcrumbs={[{ label: 'Tenant', href: '/tenant' }, { label: 'Documents' }]}
          title="Documents"
          description="Your tenancy documents, agreements and certificates."
        />
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No documents yet"
          description="Once you have a live tenancy, your AST and other paperwork will appear here."
          cta={{ label: 'Back to home', href: '/tenant' }}
        />
      </div>
    );
  }

  const showTenancy = tab === 'all' || tab === 'tenancy';
  const showCompliance = tab === 'all' || tab === 'compliance';
  const showInventory = tab === 'all' || tab === 'inventory';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Tenant', href: '/tenant' }, { label: 'Documents' }]}
        title="Documents"
        description="Your tenancy documents, agreements and certificates."
      />

      <TabBar
        activeId={tab}
        items={[
          { id: 'all', label: 'All', href: '/tenant/documents', count: view.counts.all },
          {
            id: 'tenancy',
            label: 'Tenancy',
            href: '/tenant/documents?tab=tenancy',
            count: view.counts.tenancy,
          },
          {
            id: 'compliance',
            label: 'Compliance',
            href: '/tenant/documents?tab=compliance',
            count: view.counts.compliance,
          },
          {
            id: 'inventory',
            label: 'Inventory',
            href: '/tenant/documents?tab=inventory',
            count: view.counts.inventory,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        {showTenancy ? (
          <SectionCard title="Tenancy documents">
            <TenancyDocsList rows={view.byBucket.tenancy} />
          </SectionCard>
        ) : null}

        <div className="space-y-4 lg:space-y-5">
          {showCompliance ? (
            <SectionCard title="Compliance certificates">
              <ComplianceDocsList rows={view.byBucket.compliance} />
            </SectionCard>
          ) : null}
          {showInventory ? (
            <SectionCard title="Move-in inventory">
              <InventoryDocsList rows={view.byBucket.inventory} />
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ----- Sub-components ------------------------------------------------------

function TenancyDocsList({ rows }: { rows: TenantDocumentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-light">
        No tenancy paperwork yet — your AST and prescribed information will appear here once signed.
      </p>
    );
  }
  return (
    <div>
      {rows.map((row) => (
        <TenantDocRow
          key={row.id}
          documentId={row.source === 'document' ? row.id : null}
          iconTone="blue"
          title={row.title}
          meta={metaLine(row)}
        />
      ))}
    </div>
  );
}

function ComplianceDocsList({ rows }: { rows: TenantDocumentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-light">
        No certificates yet. We&apos;ll surface Gas Safety, EICR and EPC certificates as your
        landlord uploads them.
      </p>
    );
  }
  return (
    <div>
      {rows.map((row) => {
        const tone =
          row.compliance?.status === 'overdue'
            ? 'expired'
            : row.compliance?.status === 'due_soon'
              ? 'expiring'
              : 'valid';
        const badgeLabel =
          row.compliance?.status === 'overdue'
            ? 'Expired'
            : row.compliance?.status === 'due_soon'
              ? 'Expiring'
              : 'Valid';
        return (
          <TenantDocRow
            key={row.id}
            documentId={row.source === 'document' ? row.id : null}
            iconTone="forest"
            title={row.compliance ? complianceTypeLabel(row.compliance.type) : row.title}
            meta={complianceMeta(row)}
            badge={{ label: badgeLabel, tone }}
          />
        );
      })}
    </div>
  );
}

function InventoryDocsList({ rows }: { rows: TenantDocumentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-light">
        No inventory uploaded yet. Your landlord will share the move-in inventory here.
      </p>
    );
  }
  return (
    <div>
      {rows.map((row) => (
        <TenantDocRow
          key={row.id}
          documentId={row.source === 'document' ? row.id : null}
          iconTone="amber"
          title={row.title}
          meta={metaLine(row)}
        />
      ))}
    </div>
  );
}

function metaLine(row: TenantDocumentRow): string {
  const parts: string[] = [];
  const cat = DOCUMENT_CATEGORY_RULES[row.category as DocumentCategory];
  if (cat) parts.push(cat.label);
  if (row.size_bytes != null) parts.push(formatBytes(row.size_bytes));
  parts.push(formatDate(row.created_at));
  return parts.join(' · ');
}

function complianceMeta(row: TenantDocumentRow): string {
  if (!row.compliance) return metaLine(row);
  if (row.compliance.expires_at) {
    return `Valid until ${formatDate(row.compliance.expires_at)}`;
  }
  return 'No expiry recorded';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Re-exported only to keep treeshaking happy if any caller imports them.
export type { TenantDocumentsView };
