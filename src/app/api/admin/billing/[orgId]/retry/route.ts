import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { loadOrgStripeContext, retryLatestInvoice } from '@/features/billing/server/admin-ops';
import { BusinessRuleError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Retry the most recent failed Stripe invoice for an org.
 *
 * Allowed roles: super, finance.
 *
 * Live Stripe call is gated by `STRIPE_SECRET_KEY` — when not set the
 * route returns 200 with `status: 'not_configured'` so the admin UI
 * can render a banner explaining the no-op. Either way we always write
 * an `admin_audit_log` entry for traceability.
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

    const orgId = params.orgId;
    const ctxStripe = await loadOrgStripeContext(orgId);
    const result = await retryLatestInvoice(orgId);

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'billing_retry',
      target_org_id: orgId,
      payload: {
        stripe_subscription_id: ctxStripe.stripeSubscriptionId,
        last_payment_status: ctxStripe.lastPaymentStatus,
        result,
      },
    });
    log.info({ orgId, outcome: result.status }, 'stripe invoice retry result');

    if (result.status === 'not_configured') {
      return Response.json({
        data: {
          status: 'not_configured',
          message:
            'Stripe is not configured in this environment; the retry was logged for audit but no API call was made.',
        },
      });
    }

    if (result.status === 'no_subscription' || result.status === 'no_open_invoice') {
      return Response.json({
        data: {
          status: result.status,
          message:
            result.status === 'no_subscription'
              ? 'This org has no Stripe subscription on file.'
              : 'No open or uncollectible invoice — nothing to retry.',
        },
      });
    }

    if (result.status === 'failed') {
      // Don't propagate as 500 — admins are usually retrying an *expected*
      // failure; we just want them to see the Stripe-side reason.
      throw new BusinessRuleError(`Stripe retry failed: ${result.message}`);
    }

    return Response.json({
      data: {
        status: result.status,
        invoice_id: result.invoice_id,
        stripe_status: result.stripe_status,
        paid: result.paid,
        message: result.paid
          ? 'Stripe confirmed the payment succeeded.'
          : 'Stripe accepted the retry — webhook will update the row once the bank responds.',
      },
    });
  },
  { requireAuth: true },
);
