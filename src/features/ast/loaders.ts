import 'server-only';
import { AstEnvelope } from '@/core/schemas/ast';
import { createClient } from '@/lib/supabase/server';

/**
 * Server loaders for the AST domain. Used from RSC pages so the
 * page itself never knows about Supabase clients or RPC names.
 *
 * RLS handles authorisation — landlords see their org's envelopes,
 * tenants see only theirs.
 */

export async function loadActiveEnvelopeForTenancy(tenancyId: string): Promise<AstEnvelope | null> {
  const sb = await createClient();
  const { data, error } = await sb.rpc('active_envelope_for_tenancy', {
    p_tenancy_id: tenancyId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row ? AstEnvelope.parse(row) : null;
}
