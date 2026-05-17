import { closeListing, reopenListing } from '@/features/listings/server';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * POST /api/landlord/[slug]/listings/[roomId]/close
 *
 * Closes a listing (terminal). `{ reopen: true }` flips a closed listing
 * back to draft so the landlord can re-publish.
 */
export const POST = handler<{ slug: string; roomId: string }>(
  async (ctx, { slug, roomId }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);
    const body = (await ctx.req.json().catch(() => ({}))) as { reopen?: boolean };
    const row = body.reopen ? await reopenListing(ctx, roomId) : await closeListing(ctx, roomId);
    return Response.json({ data: row });
  },
  { requireAuth: true },
);
