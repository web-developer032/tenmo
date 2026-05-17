import 'server-only';
import type { CreateCheckoutInput } from '@/core/schemas/billing';
import { AppError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { getStripeClient, resolveStripePriceId } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Mint a Stripe Checkout session for an org-tier upgrade.
 *
 * Flow:
 *   1. Caller must be an `owner` of the org (we don't let agents/staff
 *      change billing).
 *   2. Look up (or create) the Stripe Customer for the org. We persist
 *      the customer id on `org_subscriptions.stripe_customer_id` so
 *      subsequent upgrades reuse the same customer + payment methods.
 *   3. Look up the env-configured Price ID for tier+interval.
 *   4. Create a Checkout session in `subscription` mode with the org id
 *      in the metadata. The webhook handler reads that metadata to
 *      attach the resulting subscription to the right org.
 *   5. Return the Checkout URL for the browser to redirect to.
 */
export async function createCheckoutSession(
  ctx: HandlerContext,
  input: CreateCheckoutInput,
  origin: string,
): Promise<{ url: string }> {
  const user = requireUser(ctx);

  const { data: membership, error: memErr } = await ctx.supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', input.org_id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();
  if (memErr) {
    throw new AppError(500, ErrorCode.db_error, 'Membership lookup failed', {
      cause: String(memErr),
    });
  }
  if (!membership) throw new AppError(403, ErrorCode.not_org_member, 'Not an org member');
  if (membership.role !== 'owner') {
    throw new AppError(403, ErrorCode.forbidden, 'Only the org owner can change billing');
  }

  // The Zod schema already rejects `tier=free`, but TypeScript's
  // narrowed type proves it here so we can pass directly to
  // resolveStripePriceId without a cast.
  const priceId = resolveStripePriceId(input.tier, input.interval);
  const stripe = getStripeClient();
  const sb = createServiceClient();

  const { data: org, error: orgErr } = await sb
    .from('orgs')
    .select('id, name, slug')
    .eq('id', input.org_id)
    .maybeSingle();
  if (orgErr || !org) throw new AppError(404, ErrorCode.not_found, 'Org not found');

  const { data: existing } = await sb
    .from('org_subscriptions')
    .select('stripe_customer_id')
    .eq('org_id', input.org_id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: org.name,
      metadata: { org_id: org.id, org_slug: org.slug },
    });
    customerId = customer.id;
    const { error: upErr } = await sb
      .from('org_subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('org_id', org.id);
    if (upErr) {
      ctx.log.warn(
        { err: upErr, orgId: org.id, customerId },
        'failed to persist new stripe_customer_id',
      );
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/landlord/${org.slug}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/landlord/${org.slug}/billing?status=cancelled`,
    allow_promotion_codes: true,
    client_reference_id: org.id,
    subscription_data: {
      metadata: { org_id: org.id, org_slug: org.slug },
    },
    metadata: { org_id: org.id, org_slug: org.slug },
  });

  if (!session.url) {
    throw new AppError(502, ErrorCode.integration_error, 'Stripe returned no checkout URL');
  }
  return { url: session.url };
}
