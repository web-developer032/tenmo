import { FileText } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { type Column, DataTable } from '@/components/ds/data-table';
import { PageHeader } from '@/components/ds/page-header';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { DOCUMENT_CATEGORY_RULES } from '@/core/constants/documents';
import { formatBytes } from '@/core/utils/document-rules';
import { LandlordDocumentUploadModal } from '@/features/documents/components/landlord-document-upload-modal';
import {
  type LandlordDocumentRow,
  loadLandlordDocuments,
} from '@/features/documents/server/load-landlord-documents';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };
type Search = { tab?: string };

export const dynamic = 'force-dynamic';

type IconPalette = { bg: string; stroke: string };

const DEFAULT_PALETTE: IconPalette = { bg: 'bg-sand', stroke: '#5C6373' };

const ICON_BG: Record<string, IconPalette> = {
  compliance: { bg: 'bg-foam', stroke: '#085041' },
  tenancy: { bg: 'bg-blue-bg', stroke: '#185FA5' },
  inventory: { bg: 'bg-foam', stroke: '#085041' },
  rtr: { bg: 'bg-blue-bg', stroke: '#185FA5' },
  certificate: { bg: 'bg-amber-bg', stroke: '#BA7517' },
  default: DEFAULT_PALETTE,
};

export default async function LandlordDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const { slug } = await params;
  const { tab = 'all' } = (await searchParams) ?? {};
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const { rows, counts, totalBytes } = await loadLandlordDocuments(supabase, org.id);

  const tabs: TabItem[] = [
    { id: 'all', label: 'All', count: counts.all, href: tabHref(slug, 'all') },
    {
      id: 'compliance',
      label: 'Compliance',
      count: counts.compliance,
      href: tabHref(slug, 'compliance'),
    },
    {
      id: 'tenancy',
      label: 'Tenancy agreements',
      count: counts.tenancy,
      href: tabHref(slug, 'tenancy'),
    },
    {
      id: 'inventory',
      label: 'Inventories',
      count: counts.inventory,
      href: tabHref(slug, 'inventory'),
    },
    {
      id: 'rtr',
      label: 'Right to Rent',
      count: counts.rtr,
      href: tabHref(slug, 'rtr'),
    },
  ];

  const filtered = rows.filter((r) => {
    if (tab === 'all') return true;
    if (tab === 'compliance') return r.kind === 'compliance' || r.category === 'certificate';
    if (tab === 'tenancy') return r.category === 'ast' || r.category === 'prescribed_information';
    if (tab === 'inventory') return r.category === 'inventory';
    if (tab === 'rtr') return r.category === 'identity';
    return true;
  });

  const columns: Column<LandlordDocumentRow>[] = [
    {
      id: 'document',
      header: 'Document',
      mobile: 'primary',
      cell: (r) => <DocumentCell row={r} />,
    },
    {
      id: 'category',
      header: 'Category',
      mobile: 'meta',
      cell: (r) => DOCUMENT_CATEGORY_RULES[r.category]?.label ?? r.category,
    },
    {
      id: 'parent',
      header: 'Property / Tenant',
      mobile: 'secondary',
      cell: (r) => <ParentCell row={r} />,
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      cell: (r) => formatMonth(r.created_at),
    },
    {
      id: 'size',
      header: 'Size',
      align: 'right',
      cell: (r) => formatBytes(r.size_bytes),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <Link
          href={`/api/documents/${r.id}/url`}
          className="text-[12.5px] font-semibold text-forest-600 hover:underline"
        >
          View · Download
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Documents' },
        ]}
        title="Documents"
        description={
          counts.all === 0
            ? 'Upload tenancy agreements, certificates and inventories — they appear here organised by category.'
            : `${counts.all} file${counts.all === 1 ? '' : 's'} across all properties and tenants · ${formatBytes(totalBytes)}`
        }
        actions={<LandlordDocumentUploadModal />}
      />

      {counts.all === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No documents uploaded yet"
          description="Upload your first AST, certificate or inventory to start building your portfolio vault."
        />
      ) : (
        <>
          <TabBar items={tabs} activeId={tab} />
          <SectionCard padded={false}>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              emptyState={
                <p className="text-[13px] text-ink-light">No documents match this filter.</p>
              }
              className="border-0 lg:rounded-none lg:border-0"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function DocumentCell({ row }: { row: LandlordDocumentRow }) {
  const key =
    row.category === 'identity'
      ? 'rtr'
      : row.category === 'certificate' || row.kind === 'compliance'
        ? 'compliance'
        : row.category === 'ast' || row.category === 'prescribed_information'
          ? 'tenancy'
          : row.category === 'inventory'
            ? 'inventory'
            : 'default';
  const palette = ICON_BG[key] ?? DEFAULT_PALETTE;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-nav', palette.bg)}
        aria-hidden
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          role="img"
          aria-label="Document"
        >
          <title>Document</title>
          <path d="M2 1h7l3 3v9H2V1Z" stroke={palette.stroke} strokeWidth="1.2" fill="none" />
          <path d="M9 1v3h3" stroke={palette.stroke} strokeWidth="1.2" fill="none" />
        </svg>
      </div>
      <span className="truncate text-[13px] font-semibold text-ink">
        {row.title ?? row.filename}
      </span>
    </div>
  );
}

function ParentCell({ row }: { row: LandlordDocumentRow }) {
  const property = row.property_name ?? '—';
  const room = row.room_name ? ` · ${row.room_name}` : '';
  if (row.tenant_name) {
    return (
      <span className="text-[13px] text-ink">
        {row.tenant_name}
        {row.property_name ? (
          <span className="text-ink-light">
            {' '}
            · {property}
            {room}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="text-[13px] text-ink">
      {property}
      {room}
    </span>
  );
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}

function tabHref(slug: string, tab: string): string {
  return tab === 'all' ? `/landlord/${slug}/documents` : `/landlord/${slug}/documents?tab=${tab}`;
}
