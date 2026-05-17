import { ApplicationAcceptInput } from '@/core/schemas/application';
import { acceptApplication } from '@/features/applications/server';
import { resolveOrgBySlug } from '@/features/orgs/server/resolve-by-slug';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * POST /api/landlord/[slug]/applications/[id]/accept
 *
 * Body: ApplicationAcceptInput (start_date, rent_pence, deposit_scheme, …)
 *
 * Wraps the create-tenancy / flip-application / close-listing trio in a
 * single SECURITY DEFINER RPC. Sibling pending applications are auto-rejected
 * by an AFTER trigger inside the same Postgres transaction.
 */
export const POST = handler<{ slug: string; id: string }>(
  async (ctx, { slug, id }) => {
    const org = await resolveOrgBySlug(ctx, slug);
    await assertOrgMember(ctx, org.id, ['owner', 'agent']);
    const input = ApplicationAcceptInput.parse(await ctx.req.json());
    const result = await acceptApplication(ctx, id, input);
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);
