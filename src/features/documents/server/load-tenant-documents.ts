import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ComplianceStatus, ComplianceType } from '@/core/constants/compliance';
import type { DocumentCategory, DocumentKind } from '@/core/constants/documents';

/**
 * Aggregates the tenant's documents across all of their tenancies and
 * joins compliance certificate metadata for the property RLS lets them see.
 *
 * Buckets:
 *  - tenancy:    category in ('ast', 'prescribed_information', 'other_legal')
 *  - inventory:  category = 'inventory'
 *  - compliance: rows from `documents` with kind='compliance' + a synthetic
 *                row for any `compliance_items` record on the property that
 *                doesn't yet have an attached document (so the tenant still
 *                sees the certificate status row).
 *
 * Right-to-Rent identity docs are excluded by RLS server-side; we don't
 * even attempt to load category='identity'.
 */

export type TenantDocumentRow = {
  id: string;
  source: 'document' | 'compliance_item';
  title: string;
  filename: string | null;
  kind: DocumentKind | 'certificate';
  category: DocumentCategory | 'certificate';
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
  tenancy_id: string | null;
  property_id: string | null;
  storage_path: string | null;
  /** Compliance-specific extras (null for regular docs). */
  compliance: {
    type: ComplianceType;
    status: ComplianceStatus;
    expires_at: string | null;
  } | null;
};

export type TenantDocumentsBucket = 'tenancy' | 'compliance' | 'inventory';

export type TenantDocumentsView = {
  rows: TenantDocumentRow[];
  byBucket: Record<TenantDocumentsBucket, TenantDocumentRow[]>;
  counts: Record<'all' | TenantDocumentsBucket, number>;
};

const TENANCY_CATEGORIES: DocumentCategory[] = ['ast', 'prescribed_information', 'other'];
const COMPLIANCE_LABEL: Record<ComplianceType, string> = {
  hmo_licence: 'HMO Licence',
  gas_safety: 'Gas Safety Certificate',
  eicr: 'EICR (Electrical)',
  epc: 'EPC Certificate',
  pat_test: 'PAT Test Report',
  fire_risk_assessment: 'Fire Risk Assessment',
  legionella: 'Legionella Risk Assessment',
  right_to_rent: 'Right to Rent',
  smoke_alarm_test: 'Smoke Alarm Test',
  co_alarm_test: 'CO Alarm Test',
  deposit_protection: 'Deposit Protection',
};

export async function loadTenantDocuments(
  supabase: SupabaseClient,
  opts: { userId: string },
): Promise<TenantDocumentsView> {
  // Fetch active tenancies → tenancy ids + property ids.
  const tenanciesResp = await supabase
    .from('tenancies')
    .select('id, property_id, start_date')
    .eq('tenant_user_id', opts.userId)
    .in('status', ['active', 'awaiting_signature', 'awaiting_deposit']);
  if (tenanciesResp.error) throw tenanciesResp.error;
  const tenancies = tenanciesResp.data ?? [];

  if (tenancies.length === 0) {
    return {
      rows: [],
      byBucket: { tenancy: [], compliance: [], inventory: [] },
      counts: { all: 0, tenancy: 0, compliance: 0, inventory: 0 },
    };
  }

  const tenancyIds = tenancies.map((t) => t.id as string);
  const propertyIds = Array.from(
    new Set(tenancies.map((t) => t.property_id as string).filter(Boolean)),
  );

  // Two queries — one for tenancy-scoped docs, one for property-scoped
  // compliance docs — then merge. RLS will refuse rows the tenant
  // shouldn't see, so we don't need extra filters on category=identity.
  const [tenancyDocsResp, complianceDocsResp, complianceResp] = await Promise.all([
    supabase
      .from('documents')
      .select(
        'id, title, filename, kind, category, size_bytes, mime_type, created_at, storage_path, tenancy_id, property_id, compliance_item_id',
      )
      .in('tenancy_id', tenancyIds)
      .order('created_at', { ascending: false })
      .limit(200),
    propertyIds.length
      ? supabase
          .from('documents')
          .select(
            'id, title, filename, kind, category, size_bytes, mime_type, created_at, storage_path, tenancy_id, property_id, compliance_item_id',
          )
          .in('property_id', propertyIds)
          .eq('kind', 'compliance')
          .order('created_at', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length
      ? supabase
          .from('compliance_items')
          .select('id, type, status, expires_at, property_id')
          .in('property_id', propertyIds)
          .order('expires_at', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tenancyDocsResp.error) throw tenancyDocsResp.error;
  if (complianceDocsResp.error) throw complianceDocsResp.error;
  if (complianceResp.error) throw complianceResp.error;
  const rawDocsById = new Map<string, (typeof tenancyDocsResp.data)[number]>();
  for (const d of tenancyDocsResp.data ?? []) rawDocsById.set(d.id as string, d);
  for (const d of complianceDocsResp.data ?? []) rawDocsById.set(d.id as string, d);
  const rawDocs = Array.from(rawDocsById.values()).sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  );
  const complianceItems = (complianceResp.data ?? []) as Array<{
    id: string;
    type: ComplianceType;
    status: ComplianceStatus;
    expires_at: string | null;
    property_id: string | null;
  }>;

  // Pre-join compliance metadata by `compliance_item_id`.
  const complianceById = new Map<string, (typeof complianceItems)[number]>();
  for (const c of complianceItems) complianceById.set(c.id, c);

  const docRows: TenantDocumentRow[] = rawDocs.map((d) => {
    const item = (d.compliance_item_id as string | null)
      ? complianceById.get(d.compliance_item_id as string)
      : null;
    return {
      id: d.id as string,
      source: 'document',
      title:
        (d.title as string | null)?.trim() || (d.filename as string | null) || 'Untitled document',
      filename: (d.filename as string | null) ?? null,
      kind: d.kind as DocumentKind,
      category: d.category as DocumentCategory,
      size_bytes: (d.size_bytes as number | null) ?? null,
      mime_type: (d.mime_type as string | null) ?? null,
      created_at: d.created_at as string,
      tenancy_id: (d.tenancy_id as string | null) ?? null,
      property_id: (d.property_id as string | null) ?? null,
      storage_path: (d.storage_path as string | null) ?? null,
      compliance: item
        ? { type: item.type, status: item.status, expires_at: item.expires_at }
        : null,
    };
  });

  // Add a synthetic row for any compliance_item without a backing document
  // so the tenant still sees "Gas Safety — valid until …" in the right column.
  const seenItemIds = new Set<string>();
  for (const d of rawDocs) {
    const cid = d.compliance_item_id as string | null;
    if (cid) seenItemIds.add(cid);
  }
  const syntheticComplianceRows: TenantDocumentRow[] = complianceItems
    .filter((c) => !seenItemIds.has(c.id))
    .map((c) => ({
      id: `compliance:${c.id}`,
      source: 'compliance_item',
      title: COMPLIANCE_LABEL[c.type] ?? c.type,
      filename: null,
      kind: 'certificate',
      category: 'certificate',
      size_bytes: null,
      mime_type: null,
      created_at: c.expires_at ?? new Date().toISOString(),
      tenancy_id: null,
      property_id: c.property_id,
      storage_path: null,
      compliance: { type: c.type, status: c.status, expires_at: c.expires_at },
    }));

  const rows = [...docRows, ...syntheticComplianceRows];

  const byBucket: Record<TenantDocumentsBucket, TenantDocumentRow[]> = {
    tenancy: [],
    compliance: [],
    inventory: [],
  };
  for (const r of rows) {
    if (r.kind === 'compliance' || r.kind === 'certificate' || r.category === 'certificate') {
      byBucket.compliance.push(r);
    } else if (r.category === 'inventory') {
      byBucket.inventory.push(r);
    } else if (TENANCY_CATEGORIES.includes(r.category as DocumentCategory)) {
      byBucket.tenancy.push(r);
    } else {
      // Any other tenant-visible doc (e.g. "other") still lives under Tenancy.
      byBucket.tenancy.push(r);
    }
  }

  return {
    rows,
    byBucket,
    counts: {
      all: rows.length,
      tenancy: byBucket.tenancy.length,
      compliance: byBucket.compliance.length,
      inventory: byBucket.inventory.length,
    },
  };
}

export function complianceTypeLabel(type: ComplianceType): string {
  return COMPLIANCE_LABEL[type] ?? type;
}
