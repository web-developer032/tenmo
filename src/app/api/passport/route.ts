import { assemblePassportForCaller } from '@/features/passport/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/passport
 *
 * Returns the caller's assembled Rental Passport as JSON. Used by
 * the on-screen `/tenant/passport` page and any future
 * "preview before exporting" UI.
 */
export const GET = handler(
  async (ctx) => {
    const passport = await assemblePassportForCaller(ctx);
    return Response.json({ data: passport });
  },
  { requireAuth: true },
);
