import 'server-only';
import { ComplianceItem } from '@/core/schemas/compliance';
import { Property } from '@/core/schemas/property';
import {
  complianceScore,
  type GroupedCompliance,
  groupByStatus,
  missingRequiredTypes,
  requiredItemsForProperty,
} from '@/core/utils/compliance-rules';
import { createClient } from '@/lib/supabase/server';

/**
 * UI loaders for the compliance dashboard. RLS scopes results to the
 * landlord's memberships, so all of these must be called from a server
 * component (or Route Handler) for an authenticated user.
 */

export type ComplianceItemWithContext = ReturnType<typeof ComplianceItem.parse> & {
  property_name: string | null;
};

export type PropertyComplianceSummary = {
  property: ReturnType<typeof Property.parse>;
  items: ComplianceItemWithContext[];
  groups: GroupedCompliance<ComplianceItemWithContext>;
  score: number;
  missing: ReturnType<typeof missingRequiredTypes>;
  required: ReturnType<typeof requiredItemsForProperty>;
};

/**
 * Loads everything the landlord-side compliance dashboard needs:
 *  - All properties in the org
 *  - All compliance items in the org, joined with their property name
 *  - Per-property roll-up: traffic-light groups, score, missing required types
 *  - Org-wide score and grouped item list
 */
export async function loadOrgComplianceOverview(orgId: string): Promise<{
  perProperty: PropertyComplianceSummary[];
  flatItems: ComplianceItemWithContext[];
  flatGroups: GroupedCompliance<ComplianceItemWithContext>;
  orgScore: number;
}> {
  const supabase = await createClient();

  const [propertiesRes, itemsRes] = await Promise.all([
    supabase
      .from('properties')
      .select('*')
      .eq('org_id', orgId)
      .is('archived_at', null)
      .order('name'),
    supabase
      .from('compliance_items')
      .select('*, properties:property_id (name)')
      .eq('org_id', orgId)
      .order('expires_at', { ascending: true, nullsFirst: false }),
  ]);

  if (propertiesRes.error) throw propertiesRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const properties = (propertiesRes.data ?? []).map((row) => Property.parse(row));
  const flatItems: ComplianceItemWithContext[] = (itemsRes.data ?? []).map((row) => {
    const propertyName = pickFirst<{ name: string }>(row.properties)?.name ?? null;
    const parsed = ComplianceItem.parse(row);
    return { ...parsed, property_name: propertyName };
  });

  const itemsByProperty = new Map<string, ComplianceItemWithContext[]>();
  for (const it of flatItems) {
    if (!it.property_id) continue;
    const list = itemsByProperty.get(it.property_id) ?? [];
    list.push(it);
    itemsByProperty.set(it.property_id, list);
  }

  const perProperty: PropertyComplianceSummary[] = properties.map((property) => {
    const items = itemsByProperty.get(property.id) ?? [];
    const required = requiredItemsForProperty(property.type, property.is_hmo);
    return {
      property,
      items,
      groups: groupByStatus(items),
      score: complianceScore(items, required),
      missing: missingRequiredTypes(items, required),
      required,
    };
  });

  return {
    perProperty,
    flatItems,
    flatGroups: groupByStatus(flatItems),
    orgScore: complianceScore(flatItems),
  };
}

/** Loads compliance items for a single property — used on the property detail page. */
export async function loadPropertyCompliance(propertyId: string): Promise<{
  items: ReturnType<typeof ComplianceItem.parse>[];
  groups: GroupedCompliance<ReturnType<typeof ComplianceItem.parse>>;
  score: number;
  missing: ReturnType<typeof missingRequiredTypes>;
  required: ReturnType<typeof requiredItemsForProperty>;
} | null> {
  const supabase = await createClient();

  const [{ data: property, error: pErr }, { data: rows, error: iErr }] = await Promise.all([
    supabase.from('properties').select('id, type, is_hmo').eq('id', propertyId).maybeSingle(),
    supabase
      .from('compliance_items')
      .select('*')
      .eq('property_id', propertyId)
      .order('expires_at', { ascending: true, nullsFirst: false }),
  ]);

  if (pErr) throw pErr;
  if (iErr) throw iErr;
  if (!property) return null;

  const items = (rows ?? []).map((row) => ComplianceItem.parse(row));
  const required = requiredItemsForProperty(
    property.type as Parameters<typeof requiredItemsForProperty>[0],
    !!property.is_hmo,
  );
  return {
    items,
    groups: groupByStatus(items),
    score: complianceScore(items, required),
    missing: missingRequiredTypes(items, required),
    required,
  };
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
