import {
  LookupByEmailInput,
  lookupProfileByEmail,
} from '@/features/profiles/server/lookup-by-email';
import { handler, requireUser } from '@/lib/handler';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/profiles/lookup-by-email — Phase R soft-warn helper.
 *
 * Body: { email: string }  (validated as a real email)
 * Returns: { exists: boolean, email: string (normalised) }
 *
 * Auth required (so the rate limiter has a stable identifier and so we
 * never leak the existence oracle to logged-out scrapers). Hard-limited
 * to 60 req/min per (user, IP) via Upstash.
 *
 * Used by the landlord invite form to surface a non-blocking warning when
 * the typed email isn't yet on Tenantly. Cold invites still go through —
 * the warning is informational, not a hard fail.
 */
export const POST = handler(
  async (ctx) => {
    const user = requireUser(ctx);
    const ipHint =
      ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      ctx.req.headers.get('x-real-ip') ??
      'unknown';
    await rateLimit(`profiles.lookup-by-email:${user.id}:${ipHint}`);

    const json = await ctx.req.json().catch(() => ({}));
    const input = LookupByEmailInput.parse(json);
    const result = await lookupProfileByEmail(input);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
