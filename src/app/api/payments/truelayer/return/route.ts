import { z } from 'zod';
import { pollAndApplyTrueLayerPayment } from '@/features/payments/server';
import { AppError, ErrorCode } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * GET|POST /api/payments/truelayer/return?payment_id=…
 *
 * Called by the tenant's browser after it returns from the TrueLayer
 * hosted payment page. We poll TrueLayer for the latest payment status
 * and apply it to our `rent_payments` row. The actual webhook (`/api/
 * webhooks/truelayer`) will follow up to flip `confirmed` once the bank
 * settles, but this endpoint gives the tenant immediate feedback.
 *
 * Auth: requires an authenticated session (any role) — the caller is
 * the tenant who initiated the payment.
 */

const Query = z.object({
  payment_id: z.string().min(1),
});

async function poll(ctx: Parameters<Parameters<typeof handler>[0]>[0]) {
  if (!ctx.user) {
    throw new AppError(401, ErrorCode.unauthorized, 'Sign in required');
  }
  const url = ctx.req.nextUrl;
  const parsed = Query.safeParse({
    payment_id: url.searchParams.get('payment_id') ?? '',
  });
  if (!parsed.success) {
    throw new AppError(400, ErrorCode.bad_request, 'payment_id is required');
  }

  const result = await pollAndApplyTrueLayerPayment(parsed.data.payment_id);
  return Response.json({ data: result });
}

export const GET = handler(poll, { requireAuth: true });
export const POST = handler(poll, { requireAuth: true });
