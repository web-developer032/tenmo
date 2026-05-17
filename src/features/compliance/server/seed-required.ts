import 'server-only';
import { ComplianceItem } from '@/core/schemas/compliance';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Calls the `seed_required_compliance_items` Postgres RPC, which inserts
 * blank `compliance_items` rows for the certificate types a given property
 * is legally required to hold (where one doesn't already exist).
 *
 * Returns the full set of compliance items for the property after seeding.
 */
export async function seedRequiredItemsForProperty(
  ctx: HandlerContext,
  propertyId: string,
): Promise<ReturnType<typeof ComplianceItem.parse>[]> {
  const { data, error } = await ctx.supabase.rpc('seed_required_compliance_items', {
    p_property_id: propertyId,
  });

  if (error) throw new DbError(error);
  return (data ?? []).map((row: unknown) => ComplianceItem.parse(row));
}
