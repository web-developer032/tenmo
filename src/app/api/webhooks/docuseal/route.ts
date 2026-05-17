import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { applyDocuSealEvent } from '@/features/ast/server';
import { verifyDocuSealSignature } from '@/lib/docuseal/signature';
import type { DocuSealWebhookEvent } from '@/lib/docuseal/types';
import { AppError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/webhooks/docuseal — receive DocuSeal webhook events.
 *
 * Same architectural pattern as `/api/webhooks/gocardless`:
 *   1. Read raw body (signature verification needs it).
 *   2. Verify HMAC-SHA256 with `DOCUSEAL_WEBHOOK_SECRET`.
 *   3. Persist the full payload to `webhook_events` for idempotency.
 *      Event id is `<event_type>:<submission_id>:<timestamp>`.
 *   4. Apply the event with `applyDocuSealEvent`.
 *   5. Stamp `processed_at` only after success.
 *
 * Returns 200 once the event is durably recorded — DocuSeal stops
 * retrying. Any apply error is logged + stamped onto the row so a
 * future replay can pick it up.
 */

const log = () => getLogger().child({ module: 'webhooks.docuseal' });

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? nanoid();
  const signature = request.headers.get('x-docuseal-signature');
  const rawBody = await request.text();

  try {
    verifyDocuSealSignature(rawBody, signature);
  } catch (err) {
    if (err instanceof AppError) {
      log().warn(
        { err: { code: err.code, message: err.message, status: err.status }, requestId },
        'docuseal webhook signature verification failed',
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

  let event: DocuSealWebhookEvent;
  try {
    event = JSON.parse(rawBody) as DocuSealWebhookEvent;
  } catch (err) {
    log().warn({ err, requestId }, 'docuseal webhook body is not valid JSON');
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Invalid JSON', requestId } },
      { status: 400, headers: { 'x-request-id': requestId } },
    );
  }

  if (!event?.event_type || !event?.data?.id) {
    return NextResponse.json(
      { received: true, skipped: 'malformed_event' },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  }

  const eventId = `${event.event_type}:${event.data.id}:${event.timestamp ?? 'no-ts'}`;
  const sb = createServiceClient();

  const { error: insertErr } = await sb.from('webhook_events').insert({
    provider: 'docuseal',
    event_id: eventId,
    event_type: event.event_type,
    payload: event as never,
    signature: signature ?? null,
  });
  if (insertErr) {
    if (insertErr.code === '23505') {
      log().info({ eventId, requestId }, 'duplicate docuseal event — already received');
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200, headers: { 'x-request-id': requestId } },
      );
    }
    log().error({ err: insertErr, eventId, requestId }, 'failed to persist webhook event');
    return NextResponse.json(
      { error: { code: 'db_error', message: 'persist failed', requestId } },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }

  try {
    await applyDocuSealEvent(event);
    await sb
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString(), attempts: 1 })
      .eq('provider', 'docuseal')
      .eq('event_id', eventId);
    log().info({ eventId, requestId }, 'docuseal webhook applied');
    return NextResponse.json(
      { received: true, applied: true },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await sb
      .from('webhook_events')
      .update({ error: message, attempts: 1 })
      .eq('provider', 'docuseal')
      .eq('event_id', eventId);
    log().error({ err, eventId, requestId }, 'docuseal webhook apply failed');
    return NextResponse.json(
      { error: { code: 'internal_error', message, requestId } },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
