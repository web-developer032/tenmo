import { z } from 'zod';
import { assertAdmin } from '@/features/admin/server';
import { BusinessRuleError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Search every `profiles` row by email or name. Admin-only.
 *
 * Used by the topbar all-profiles popover that replaces the legacy
 * "list every profile" function of the old `/admin/users` page.
 * Returns up to 10 hits with id + name + email so the client can
 * navigate straight to `/admin/users/[id]`.
 */

const Query = z
  .object({
    q: z.string().trim().min(2).max(120),
  })
  .strict();

export const GET = handler(
  async (ctx) => {
    await assertAdmin(ctx);
    const url = new URL(ctx.req.url);
    const parsed = Query.parse({ q: url.searchParams.get('q') ?? '' });
    const term = `%${parsed.q}%`;

    const { data, error } = await ctx.supabase
      .from('profiles')
      .select('id, full_name, preferred_name, contact_email')
      .or(`contact_email.ilike.${term},full_name.ilike.${term},preferred_name.ilike.${term}`)
      .limit(10);
    if (error) throw new DbError(error);
    if (!data) throw new BusinessRuleError('Profile search failed');

    return Response.json({ data });
  },
  { requireAuth: true },
);
