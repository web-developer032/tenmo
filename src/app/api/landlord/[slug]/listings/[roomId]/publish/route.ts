import { ListingPublishInput } from '@/core/schemas/listing';
import { publishListing } from '@/features/listings/server';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * POST /api/landlord/[slug]/listings/[roomId]/publish
 *
 * Body: ListingPublishInput
 *
 * Tier-gating: at MVP listings are available on every tier (discovery is the
 * acquisition feature). The landlord-role membership check is the gate.
 */
export const POST = handler<{ slug: string; roomId: string }>(
  async (ctx, { slug, roomId }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);
    const input = ListingPublishInput.parse(await ctx.req.json().catch(() => ({})));
    const row = await publishListing(ctx, roomId, input);
    return Response.json({ data: row });
  },
  { requireAuth: true },
);
