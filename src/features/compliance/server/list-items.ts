import 'server-only';
import { ComplianceItem, type ComplianceListFilter } from '@/core/schemas/compliance';
import type { HandlerContext } from '@/lib/handler';

export type ComplianceItemRow = ReturnType<typeof ComplianceItem.parse>;

/**
 * List compliance items for an org. RLS scopes results to the calling user's
 * memberships, so org filtering here is for query efficiency, not security.
 */
export async function listOrgComplianceItems(
  ctx: HandlerContext,
  orgId: string,
  filter: ComplianceListFilter = {},
): Promise<ComplianceItemRow[]> {
  let query = ctx.supabase
    .from('compliance_items')
    .select('*')
    .eq('org_id', orgId)
    .order('expires_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (filter.property_id) query = query.eq('property_id', filter.property_id);
  if (filter.type) query = query.eq('type', filter.type);
  if (filter.status) query = query.eq('status', filter.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ComplianceItem.parse(row));
}

/** Load a single compliance item — returns null if not found / not visible. */
export async function loadComplianceItem(
  ctx: HandlerContext,
  itemId: string,
): Promise<ComplianceItemRow | null> {
  const { data, error } = await ctx.supabase
    .from('compliance_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return ComplianceItem.parse(data);
}
