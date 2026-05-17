import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { applyStripeWebhookEvent } from '@/features/billing/server';
import { AppError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import { verifyStripeEvent } from '@/lib/stripe/events';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/webhooks/stripe — receive Stripe webhook events.
 *
 * Not wrapped by `handler()` because:
 *   1. Signature verification needs the *raw* body, before any JSON
 *      parsing happens. The wrapper assumes JSON.
 *   2. We must never attempt cookie-based auth here — Stripe's signature
 *      is the only authentication.
 *   3. Stripe expects very specific status codes (200 = stop retrying,
 *      4xx/5xx = retry). The wrapper's error envelope doesn't fit.
 *
 * Idempotency:
 *   * Every event lands in `webhook_events` keyed by
 *     (provider='stripe', event_id). The unique constraint plus an
 *     `on conflict do nothing` makes re-deliveries cheap and silent.
 *   * `processed_at` is stamped only after `applyStripeWebhookEvent`
 *     succeeds, so we can distinguish "received" from "applied" in
 *     the audit log.
 *   * If applying fails we leave `processed_at` null and return 500
 *     so Stripe retries.
 *
 * Logs but never throws on signature failure (Stripe expects 400 there).
 */

const log = () => getLogger().child({ module: 'webhooks.stripe' });

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? nanoid();
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = verifyStripeEvent(rawBody, signature);
  } catch (err) {
    if (err instanceof AppError) {
      log().warn(
        { err: { code: err.code, message: err.message, status: err.status }, requestId },
        'webhook signature verification failed',
      );
      return NextResponse.json(
        { error: { code: err.code, message: err.message, requestId } },
        { status: err.status, headers: { 'x-request-id': requestId } },
      );
    }
    log().error({ err, requestId }, 'unexpected verification error');
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'verification failed', requestId } },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }

  const sb = createServiceClient();

  // Idempotent insert. The unique (provider, event_id) constraint
  // means a duplicate delivery silently no-ops.
  const { error: insertErr } = await sb.from('webhook_events').insert({
    provider: 'stripe',
    event_id: event.id,
    event_type: event.type,
    payload: event as never,
    signature: signature ?? null,
  });
  if (insertErr) {
    if (insertErr.code === '23505') {
      // Duplicate — Stripe is retrying. Tell Stripe to stop.
      log().info(
        { eventId: event.id, type: event.type, requestId },
        'duplicate stripe event — already received',
      );
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200, headers: { 'x-request-id': requestId } },
      );
    }
    log().error(
      { err: insertErr, eventId: event.id, requestId },
      'failed to persist webhook event',
    );
    return NextResponse.json(
      { error: { code: 'db_error', message: 'persist failed', requestId } },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }

  try {
    const result = await applyStripeWebhookEvent(event);
    await sb
      .from('webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        attempts: 1,
      })
      .eq('provider', 'stripe')
      .eq('event_id', event.id);

    log().info(
      {
        eventId: event.id,
        type: event.type,
        kind: result.kind,
        orgId: result.org_id,
        requestId,
      },
      'webhook applied',
    );
    return NextResponse.json(
      { received: true, applied: result.applied, kind: result.kind },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await sb
      .from('webhook_events')
      .update({
        error: message,
        attempts: 1,
      })
      .eq('provider', 'stripe')
      .eq('event_id', event.id);
    log().error({ err, eventId: event.id, type: event.type, requestId }, 'webhook apply failed');
    return NextResponse.json(
      { error: { code: 'internal_error', message, requestId } },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
