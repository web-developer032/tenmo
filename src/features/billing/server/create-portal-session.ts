import 'server-only';
import type { CreatePortalInput } from '@/core/schemas/billing';
import { AppError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { getStripeClient } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Create a Stripe Customer Portal session so the org owner can manage
 * payment method, invoices, plan changes, and cancellation in one
 * place — Stripe-hosted, fully PCI-compliant, no custom UI required.
 *
 * Owner-only. We hard-fail if the org has no `stripe_customer_id` yet
 * (i.e. they've never visited Checkout) — the UI shouldn't show the
 * "Manage billing" button in that state, but defence-in-depth.
 */
export async function createPortalSession(
  ctx: HandlerContext,
  input: CreatePortalInput,
  origin: string,
): Promise<{ url: string }> {
  const user = requireUser(ctx);

  const { data: membership } = await ctx.supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', input.org_id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();
  if (!membership) throw new AppError(403, ErrorCode.not_org_member, 'Not an org member');
  if (membership.role !== 'owner') {
    throw new AppError(403, ErrorCode.forbidden, 'Only the org owner can manage billing');
  }

  const sb = createServiceClient();
  const { data: sub, error: subErr } = await sb
    .from('org_subscriptions')
    .select('stripe_customer_id')
    .eq('org_id', input.org_id)
    .maybeSingle();
  if (subErr) {
    throw new AppError(500, ErrorCode.db_error, 'Subscription lookup failed', {
      cause: String(subErr),
    });
  }
  if (!sub?.stripe_customer_id) {
    throw new AppError(
      400,
      ErrorCode.bad_request,
      'No Stripe customer for this org yet. Upgrade to a paid plan first.',
    );
  }

  const { data: org } = await sb.from('orgs').select('slug').eq('id', input.org_id).maybeSingle();
  if (!org) throw new AppError(404, ErrorCode.not_found, 'Org not found');

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/landlord/${org.slug}/billing`,
  });

  return { url: session.url };
}
