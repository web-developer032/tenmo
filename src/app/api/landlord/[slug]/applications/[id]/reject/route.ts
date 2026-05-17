import { ApplicationRejectInput } from '@/core/schemas/application';
import { rejectApplication } from '@/features/applications/server';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * POST /api/landlord/[slug]/applications/[id]/reject
 *
 * Body: { decline_reason: string } — required (length 1-500). The DB also
 * enforces this via the `room_applications_rejected_has_reason` check.
 */
export const POST = handler<{ slug: string; id: string }>(
  async (ctx, { slug, id }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);
    const input = ApplicationRejectInput.parse(await ctx.req.json().catch(() => ({})));
    const application = await rejectApplication(ctx, id, input);
    return Response.json({ data: application });
  },
  { requireAuth: true },
);
