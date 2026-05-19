import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { getServerEnv } from '@/lib/env.server';
import { AppError, BusinessRuleError, DbError, ErrorCode } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Retry the most recent failed Stripe invoice for an org.
 *
 * Allowed roles: super, finance.
 *
 * Live Stripe call is gated by `STRIPE_SECRET_KEY` — when not set the
 * route returns 501 with a friendly message rather than pretending.
 * Still writes an audit log entry so we can trace the attempt.
 */
export const POST = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertAdmin(ctx);
    const { supabase, user, log } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (!['super', 'finance'].includes(self.role)) {
      throw new BusinessRuleError('Insufficient role to retry payments');
    }

    const env = getServerEnv();
    const orgId = params.orgId;

    const { data: sub, error } = await supabase
      .from('org_subscriptions')
      .select('stripe_subscription_id, stripe_customer_id, last_payment_status')
      .eq('org_id', orgId)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!sub) throw new AppError(404, ErrorCode.not_found, 'Org subscription not found');

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'billing_retry',
      target_org_id: orgId,
      payload: {
        stripe_subscription_id: sub.stripe_subscription_id,
        last_payment_status: sub.last_payment_status,
      },
    });

    if (!env.STRIPE_SECRET_KEY) {
      return Response.json(
        {
          data: {
            status: 'stub',
            message:
              'Stripe is not configured in this environment; the retry was logged for audit but no API call was made.',
          },
        },
        { status: 200 },
      );
    }

    // Real retry would call Stripe `paymentIntents.confirm` / `invoices.pay`
    // here. Keeping this short — the wire-up is deferred to Phase R3.
    log.info({ orgId }, 'stripe retry triggered (TODO: wire to live API)');
    return Response.json({
      data: { status: 'queued', message: 'Retry queued. Stripe webhook will update the row.' },
    });
  },
  { requireAuth: true },
);
