import 'server-only';
import type { GoCardlessMandate } from '@/core/schemas/payments';
import { GoCardlessMandate as GoCardlessMandateSchema } from '@/core/schemas/payments';
import { createClient } from '@/lib/supabase/server';

/**
 * Server loaders for the payments domain. Exposed to RSC pages so they
 * stay framework-agnostic — the RSC just calls these and passes data
 * down.
 *
 * RLS is the only authorisation gate here; landlords automatically
 * see their org's mandates, tenants see only theirs (the
 * `gc_mandates_select_*` policies cover both).
 */

export async function loadActiveMandateForTenancy(
  tenancyId: string,
): Promise<GoCardlessMandate | null> {
  const sb = await createClient();
  const { data, error } = await sb.rpc('active_mandate_for_tenancy', {
    p_tenancy_id: tenancyId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row ? GoCardlessMandateSchema.parse(row) : null;
}
