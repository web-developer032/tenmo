import { pauseListing, resumeListing } from '@/features/listings/server';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * POST /api/landlord/[slug]/listings/[roomId]/pause
 *
 * Pauses a published listing (`published` -> `paused`). Pass
 * `{ resume: true }` in the body to flip a paused listing back to published
 * — handled here rather than a separate endpoint to keep the router tree
 * shallow.
 */
export const POST = handler<{ slug: string; roomId: string }>(
  async (ctx, { slug, roomId }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);
    const body = (await ctx.req.json().catch(() => ({}))) as { resume?: boolean };
    const row = body.resume ? await resumeListing(ctx, roomId) : await pauseListing(ctx, roomId);
    return Response.json({ data: row });
  },
  { requireAuth: true },
);
