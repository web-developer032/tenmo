import { ApplicationCreate } from '@/core/schemas/application';
import { applyToListing } from '@/features/applications/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/listings/[roomId]/apply — auth tenant submits an application.
 *
 * Body: { message?: string }
 *
 * Returns the created `room_applications` row. The landlord is notified
 * (in-app + email) on a fire-and-forget basis.
 */
export const POST = handler<{ roomId: string }>(
  async (ctx, { roomId }) => {
    const json = await ctx.req.json().catch(() => ({}));
    const input = ApplicationCreate.parse(json);
    const application = await applyToListing(ctx, roomId, input);
    return Response.json({ data: application }, { status: 201 });
  },
  { requireAuth: true },
);
