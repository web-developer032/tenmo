import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Resolve (or lazily create) the conversation id for a given tenancy.
 *
 * The DB has a trigger that auto-creates the conversation on tenancy
 * status changes, but we still call `ensure_tenancy_conversation` here
 * as a belt-and-braces step in case the trigger missed (e.g. legacy
 * rows from before the migration, or seeded data).
 *
 * Returns null when:
 *   * the tenancy doesn't exist;
 *   * the tenancy has no `tenant_user_id` yet (still pending invite);
 *   * the org has no owner (shouldn't happen but we guard).
 */
export async function resolveTenancyConversationId(tenancyId: string): Promise<string | null> {
  const sb = createServiceClient();

  const { data: existing } = await sb
    .from('conversations')
    .select('id')
    .eq('tenancy_id', tenancyId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await sb.rpc('ensure_tenancy_conversation', {
    p_tenancy_id: tenancyId,
  });
  if (error) return null;
  return (data as string | null) ?? null;
}
