import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { applyTrueLayerStatus } from '@/features/payments/server';
import { AppError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyTrueLayerSignature } from '@/lib/truelayer';

/**
 * POST /api/webhooks/truelayer — receive TrueLayer webhook events.
 *
 * Architecture matches the Stripe + GoCardless handlers:
 *   1. Verify the HMAC signature on the raw body (`TRUELAYER_WEBHOOK_SECRET`).
 *   2. Persist the event to `webhook_events` keyed by (provider='truelayer',
 *      event_id) so the unique constraint deduplicates retries.
 *   3. Apply the event via `applyTrueLayerStatus`.
 *   4. Stamp `processed_at` after success — failures leave it null so the
 *      replay cron picks them up.
 *
 * Webhook payload (legacy/HMAC mode):
 *   {
 *     "event_id": "...",
 *     "type": "payment_executed" | "payment_settled" | "payment_failed" | ...,
 *     "payment_id": "...",
 *     "status": "executed" | "settled" | "failed" | "authorized" | ...,
 *     "failure_reason": "string?"
 *   }
 *
 * We map the `status` field through the same `TL_STATUS_MAP` used by the
 * polling path so the two reconciliation routes stay consistent.
 */

interface TlWebhookPayload {
  event_id?: string;
  type?: string;
  payment_id?: string;
  status?:
    | 'authorization_required'
    | 'authorizing'
    | 'authorized'
    | 'executed'
    | 'settled'
    | 'failed';
  failure_reason?: string;
}

const log = () => getLogger().child({ module: 'webhooks.truelayer' });

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? nanoid();
  const signature = request.headers.get('tl-signature');
  const rawBody = await request.text();

  try {
    verifyTrueLayerSignature(rawBody, signature);
  } catch (err) {
    if (err instanceof AppError) {
      log().warn(
        { err: { code: err.code, message: err.message, status: err.status }, requestId },
        'truelayer webhook signature failed',
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

  let payload: TlWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TlWebhookPayload;
  } catch (err) {
    log().warn({ err, requestId }, 'invalid JSON body');
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Invalid JSON', requestId } },
      { status: 400, headers: { 'x-request-id': requestId } },
    );
  }

  if (!payload.event_id || !payload.payment_id || !payload.status) {
    return NextResponse.json(
      {
        error: {
          code: 'bad_request',
          message: 'event_id, payment_id and status are required',
          requestId,
        },
      },
      { status: 400, headers: { 'x-request-id': requestId } },
    );
  }

  const sb = createServiceClient();
  const { error: insertErr } = await sb.from('webhook_events').insert({
    provider: 'truelayer',
    event_id: payload.event_id,
    event_type: payload.type ?? `status:${payload.status}`,
    payload: payload as never,
    signature: signature ?? null,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      log().info({ eventId: payload.event_id, requestId }, 'duplicate truelayer event');
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200, headers: { 'x-request-id': requestId } },
      );
    }
    log().error({ err: insertErr, requestId }, 'persist truelayer webhook failed');
    return NextResponse.json(
      { error: { code: 'db_error', message: 'persist failed', requestId } },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }

  try {
    const result = await applyTrueLayerStatus({
      paymentId: payload.payment_id,
      status: payload.status,
      failureReason: payload.failure_reason ?? null,
    });
    await sb
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString(), attempts: 1 })
      .eq('provider', 'truelayer')
      .eq('event_id', payload.event_id);

    log().info(
      { eventId: payload.event_id, status: payload.status, result, requestId },
      'truelayer webhook applied',
    );
    return NextResponse.json(
      { received: true, result },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await sb
      .from('webhook_events')
      .update({ error: message, attempts: 1 })
      .eq('provider', 'truelayer')
      .eq('event_id', payload.event_id);
    log().error({ err, requestId }, 'truelayer webhook apply failed');
    return NextResponse.json(
      { error: { code: 'internal_error', message, requestId } },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
