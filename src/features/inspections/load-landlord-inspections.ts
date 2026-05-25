import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type InspectionType =
  | 'routine_quarterly'
  | 'move_in'
  | 'move_out'
  | 'interim'
  | 'compliance';
export type InspectionStatus = 'scheduled' | 'completed' | 'overdue' | 'cancelled';
export type InspectionOutcome = 'no_issues' | 'minor' | 'major' | 'fail';

export type InspectionRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  type: InspectionType;
  scheduledFor: string;
  inspectorName: string | null;
  tenantNotifiedAt: string | null;
  outcome: InspectionOutcome | null;
  status: InspectionStatus;
  reportDocumentId: string | null;
  notes: string | null;
};

export type LandlordInspectionsData = {
  rows: InspectionRow[];
  kpis: {
    upcoming: number;
    overdue: number;
    completedYtd: number;
    passRatePercent: number;
  };
};

type InspectionQueryRow = {
  id: string;
  property_id: string;
  type: InspectionType;
  status: InspectionStatus;
  scheduled_for: string;
  inspector_name: string | null;
  tenant_notified_at: string | null;
  completed_at: string | null;
  outcome: InspectionOutcome | null;
  report_document_id: string | null;
  notes: string | null;
  properties: { id: string; name: string } | { id: string; name: string }[] | null;
};

function firstOf<T>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}

/**
 * Loads the inspections register for the landlord console. We also
 * coerce any `scheduled` row whose `scheduled_for` is in the past to
 * `overdue` so the UI labelling stays accurate without a server cron.
 */
export async function loadLandlordInspections(
  supabase: SupabaseClient,
  orgId: string,
  now: Date = new Date(),
): Promise<LandlordInspectionsData> {
  const { data, error } = await supabase
    .from('inspections')
    .select(
      `id, property_id, type, status, scheduled_for, inspector_name,
       tenant_notified_at, completed_at, outcome, report_document_id, notes,
       properties:property_id (id, name)`,
    )
    .eq('org_id', orgId)
    .order('scheduled_for', { ascending: false });

  if (error) throw error;
  const raw = (data ?? []) as InspectionQueryRow[];

  const todayIso = now.toISOString().slice(0, 10);
  const yearStartIso = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);

  const rows: InspectionRow[] = raw.map((r) => {
    let status = r.status;
    if (status === 'scheduled' && r.scheduled_for < todayIso) status = 'overdue';
    const property = firstOf<{ id: string; name: string }>(r.properties);
    return {
      id: r.id,
      propertyId: r.property_id,
      propertyName: property?.name ?? '—',
      type: r.type,
      scheduledFor: r.scheduled_for,
      inspectorName: r.inspector_name,
      tenantNotifiedAt: r.tenant_notified_at,
      outcome: r.outcome,
      status,
      reportDocumentId: r.report_document_id,
      notes: r.notes,
    };
  });

  const upcoming = rows.filter((r) => r.status === 'scheduled').length;
  const overdue = rows.filter((r) => r.status === 'overdue').length;
  const completedYtd = rows.filter(
    (r) => r.status === 'completed' && r.scheduledFor >= yearStartIso,
  ).length;
  const completedAll = rows.filter((r) => r.status === 'completed');
  const passing = completedAll.filter(
    (r) => r.outcome === 'no_issues' || r.outcome === 'minor',
  ).length;
  const passRatePercent =
    completedAll.length > 0 ? Math.round((passing / completedAll.length) * 100) : 0;

  return {
    rows,
    kpis: { upcoming, overdue, completedYtd, passRatePercent },
  };
}
