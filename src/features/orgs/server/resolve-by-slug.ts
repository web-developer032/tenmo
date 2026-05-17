import 'server-only';
import { DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Resolve `{ id, slug, name }` for a landlord-org slug.
 *
 * Centralised so every `/api/landlord/[slug]/...` route uses the same
 * lookup + 404 wording (and so we have a single seam to add caching later).
 */
export async function resolveOrgBySlug(
  ctx: HandlerContext,
  slug: string,
): Promise<{ id: string; slug: string; name: string }> {
  const { data, error } = await ctx.supabase
    .from('orgs')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new DbError(error);
  if (!data) throw new NotFoundError('Organisation not found');
  return data as { id: string; slug: string; name: string };
}
