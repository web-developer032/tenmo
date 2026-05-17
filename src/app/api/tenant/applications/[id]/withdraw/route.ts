import { withdrawApplication } from '@/features/applications/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/tenant/applications/[id]/withdraw — applicant cancels their
 * own pending application. Only `pending` rows can be withdrawn; once a
 * decision has been made the row is final.
 */
export const POST = handler<{ id: string }>(
  async (ctx, { id }) => {
    const application = await withdrawApplication(ctx, id);
    return Response.json({ data: application });
  },
  { requireAuth: true },
);
