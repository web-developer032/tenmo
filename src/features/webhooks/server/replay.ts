import 'server-only';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Replay unprocessed webhook events for Stripe / GoCardless / TrueLayer.
 *
 * The webhook routes persist every envelope to `webhook_events` BEFORE
 * applying business logic. When apply fails (DB error, network blip,
 * downstream RLS issue) the row keeps `processed_at = null` and an
 * `error` string. This worker picks those rows up on a 15-minute cron
 * and re-applies them — with attempt-count back-off so a truly broken
 * payload doesn't loop forever.
 *
 * Worker contract:
 *   * `MAX_ATTEMPTS` = 5. After that the row is left alone (admin can
 *     manually re-queue from /admin/audit if needed).
 *   * Each provider has its own apply function imported lazily so the
 *     worker doesn't pull every integration into a single bundle.
 *
 * This is intentionally simple — no exponential backoff, no priority
 * queue. The cron fires every 15 minutes and processes whatever is
 * pending; under sustained failure the operator gets pinged via the
 * Sentry capture in `withErrorTrap`.
 */

const log = () => getLogger().child({ module: 'webhooks.replay' });

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;

export type WebhookReplayResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  details: Array<{
    provider: string;
    event_id: string;
    outcome: 'succeeded' | 'failed' | 'skipped';
    error?: string;
  }>;
};

export async function replayPendingWebhookEvents(): Promise<WebhookReplayResult> {
  const sb = createServiceClient();
  const { data: rows, error } = await sb
    .from('webhook_events')
    .select('id, provider, event_id, event_type, payload, attempts')
    .is('processed_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);
  if (error) {
    log().error({ err: error }, 'failed to read unprocessed webhook_events');
    throw error;
  }

  const result: WebhookReplayResult = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  for (const row of rows ?? []) {
    result.attempted += 1;
    const nextAttempts = (row.attempts ?? 0) + 1;
    try {
      await applyByProvider(row.provider, row.payload);
      const { error: upErr } = await sb
        .from('webhook_events')
        .update({
          processed_at: new Date().toISOString(),
          error: null,
          attempts: nextAttempts,
        })
        .eq('id', row.id);
      if (upErr) throw upErr;
      result.succeeded += 1;
      result.details.push({
        provider: row.provider,
        event_id: row.event_id,
        outcome: 'succeeded',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      await sb
        .from('webhook_events')
        .update({ error: message, attempts: nextAttempts })
        .eq('id', row.id);

      if (nextAttempts >= MAX_ATTEMPTS) {
        result.skipped += 1;
        result.details.push({
          provider: row.provider,
          event_id: row.event_id,
          outcome: 'skipped',
          error: `max attempts (${MAX_ATTEMPTS}) reached: ${message}`,
        });
      } else {
        result.failed += 1;
        result.details.push({
          provider: row.provider,
          event_id: row.event_id,
          outcome: 'failed',
          error: message,
        });
      }
    }
  }

  log().info(
    {
      attempted: result.attempted,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
    },
    'webhook replay batch complete',
  );
  return result;
}

async function applyByProvider(provider: string, payload: unknown): Promise<void> {
  switch (provider) {
    case 'stripe': {
      const { applyStripeWebhookEvent } = await import('@/features/billing/server');
      // `applyStripeWebhookEvent` expects a `Stripe.Event` shape.
      // The persisted payload is the raw event JSON, which matches.
      await applyStripeWebhookEvent(payload as never);
      return;
    }
    case 'gocardless': {
      const { applyGoCardlessEvents } = await import('@/features/payments/server');
      const envelope = payload as { events?: unknown[] };
      const events = (envelope.events ?? []) as never;
      await applyGoCardlessEvents(events);
      return;
    }
    case 'truelayer': {
      const { applyTrueLayerStatus } = await import('@/features/payments/server');
      const p = payload as {
        payment_id?: string;
        status?: string;
        failure_reason?: string;
      };
      if (!p.payment_id || !p.status) return;
      await applyTrueLayerStatus({
        paymentId: p.payment_id,
        status: p.status as never,
        failureReason: p.failure_reason ?? null,
      });
      return;
    }
    case 'docuseal': {
      // DocuSeal's existing handler does its own dedupe; replay is a
      // no-op for now (the AST flow re-syncs on next render).
      log().info({ provider }, 'docuseal replay no-op');
      return;
    }
    default:
      log().warn({ provider }, 'unknown webhook provider during replay — skipping');
  }
}
