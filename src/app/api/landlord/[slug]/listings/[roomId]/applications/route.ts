import { listApplicationsForRoom } from '@/features/applications/server';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * GET /api/landlord/[slug]/listings/[roomId]/applications
 *
 * Returns the applicant queue for a room, sorted with accepted (if any) at
 * the top, then pending oldest-first, then rejected/withdrawn at the bottom.
 */
export const GET = handler<{ slug: string; roomId: string }>(
  async (ctx, { slug, roomId }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id);
    const result = await listApplicationsForRoom(ctx, roomId);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
