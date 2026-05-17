import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { applyGoCardlessEvents } from '@/features/payments/server';
import { AppError } from '@/lib/errors';
import { verifyGoCardlessSignature } from '@/lib/gocardless/signature';
import type { GcWebhookEnvelope } from '@/lib/gocardless/types';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/webhooks/gocardless — receive GoCardless webhook envelopes.
 *
 * Same architectural pattern as the Stripe handler:
 *   1. Read the raw body (signature verification needs it).
 *   2. Verify HMAC-SHA256 signature with `GOCARDLESS_WEBHOOK_SECRET`.
 *   3. Persist the entire envelope to `webhook_events` keyed by
 *      (provider='gocardless', event_id). The unique constraint dedupes
 *      retries; we use the *envelope* id (each `events[].id` is a sub-
 *      event) so partial retries don't double-apply.
 *   4. Walk the events through `applyGoCardlessEvents`.
 *   5. Stamp `processed_at` only after success — failures leave it null
 *      so the cron-style replay job (deferred) can pick them back up.
 *
 * Not wrapped by `handler()` for the same reasons as Stripe (raw body,
 * signature-only auth, specific status code semantics).
 */

const log = () => getLogger().child({ module: 'webhooks.gocardless' });

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? nanoid();
  const signature = request.headers.get('webhook-signature');
  const rawBody = await request.text();

  try {
    verifyGoCardlessSignature(rawBody, signature);
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

  let envelope: GcWebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as GcWebhookEnvelope;
  } catch (err) {
    log().warn({ err, requestId }, 'webhook body is not valid JSON (post-signature)');
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Invalid JSON', requestId } },
      { status: 400, headers: { 'x-request-id': requestId } },
    );
  }

  if (!envelope?.events || envelope.events.length === 0) {
    return NextResponse.json(
      { received: true, applied: 0, skipped: 'empty_envelope' },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  }

  // GC envelopes don't have a top-level id; we synthesise one from the
  // first event's id (envelopes are stable in GC's docs but we treat
  // them as the unit of idempotency for safety).
  const firstEvent = envelope.events[0];
  if (!firstEvent) {
    return NextResponse.json(
      { received: true, applied: 0, skipped: 'empty_envelope' },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  }
  const envelopeId = `env-${firstEvent.id}`;

  const sb = createServiceClient();

  const { error: insertErr } = await sb.from('webhook_events').insert({
    provider: 'gocardless',
    event_id: envelopeId,
    event_type: `envelope:${envelope.events.length}`,
    payload: envelope as never,
    signature: signature ?? null,
  });
  if (insertErr) {
    if (insertErr.code === '23505') {
      log().info(
        { envelopeId, count: envelope.events.length, requestId },
        'duplicate gocardless envelope — already received',
      );
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200, headers: { 'x-request-id': requestId } },
      );
    }
    log().error({ err: insertErr, envelopeId, requestId }, 'failed to persist webhook event');
    return NextResponse.json(
      { error: { code: 'db_error', message: 'persist failed', requestId } },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }

  try {
    const results = await applyGoCardlessEvents(envelope.events);
    const applied = results.filter((r) => r.applied).length;
    await sb
      .from('webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        attempts: 1,
      })
      .eq('provider', 'gocardless')
      .eq('event_id', envelopeId);
    log().info(
      { envelopeId, count: envelope.events.length, applied, requestId },
      'gocardless webhook applied',
    );
    return NextResponse.json(
      { received: true, applied, total: envelope.events.length },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await sb
      .from('webhook_events')
      .update({ error: message, attempts: 1 })
      .eq('provider', 'gocardless')
      .eq('event_id', envelopeId);
    log().error({ err, envelopeId, requestId }, 'gocardless webhook apply failed');
    return NextResponse.json(
      { error: { code: 'internal_error', message, requestId } },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
