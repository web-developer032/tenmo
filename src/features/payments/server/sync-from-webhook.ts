import 'server-only';
import type { GcWebhookEvent } from '@/lib/gocardless/types';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import {
  notifyMandateActive,
  notifyMandateFailed,
  notifyRentFailed,
  notifyRentPaid,
} from './notify-payment';
import { mapMandateActionToStatus, mapPaymentActionToStatus } from './webhook-mapping';

/**
 * Apply a verified GoCardless webhook event to our local state.
 *
 * Idempotency: the route persists the entire envelope to
 * `webhook_events` keyed by (provider='gocardless', event_id). We're
 * called once per envelope by the route, then we walk the events
 * inside; if applying a single event fails we still return the partial
 * result and the route stamps `processed_at`. The cron-style replay
 * job (deferred) re-applies any unprocessed envelope.
 *
 * Error handling: throws on hard failures (DB error). Soft problems
 * (missing rows, unknown event type) just log and continue.
 */

const log = () => getLogger().child({ module: 'payments.sync-from-webhook' });

export type EventApplyResult = {
  event_id: string;
  applied: boolean;
  kind: 'mandate_updated' | 'payment_updated' | 'noop';
  /** Optional human reason for diagnostics (e.g. "unknown_action"). */
  reason?: string;
};

export async function applyGoCardlessEvents(events: GcWebhookEvent[]): Promise<EventApplyResult[]> {
  const results: EventApplyResult[] = [];
  for (const event of events) {
    try {
      results.push(await applyOne(event));
    } catch (err) {
      log().error({ err, eventId: event.id, type: event.resource_type }, 'event apply failed');
      throw err;
    }
  }
  return results;
}

async function applyOne(event: GcWebhookEvent): Promise<EventApplyResult> {
  switch (event.resource_type) {
    case 'mandates':
      return applyMandateEvent(event);
    case 'payments':
      return applyPaymentEvent(event);
    default:
      log().debug({ eventId: event.id, type: event.resource_type }, 'event type ignored');
      return { event_id: event.id, applied: false, kind: 'noop', reason: 'unsupported_resource' };
  }
}

async function applyMandateEvent(event: GcWebhookEvent): Promise<EventApplyResult> {
  const gcMandateId = event.links.mandate;
  if (!gcMandateId) {
    return { event_id: event.id, applied: false, kind: 'noop', reason: 'no_mandate_link' };
  }
  const newStatus = mapMandateActionToStatus(event.action);
  if (!newStatus) {
    log().debug({ action: event.action, eventId: event.id }, 'unknown mandate action');
    return { event_id: event.id, applied: false, kind: 'noop', reason: 'unknown_action' };
  }

  const sb = createServiceClient();
  const { data: row, error } = await sb
    .from('gocardless_mandates')
    .select('id, org_id, tenancy_id, tenant_user_id, status')
    .eq('gc_mandate_id', gcMandateId)
    .maybeSingle();
  if (error) throw error;
  if (!row) {
    log().warn({ gcMandateId, eventId: event.id }, 'mandate webhook for unknown row');
    return { event_id: event.id, applied: false, kind: 'noop', reason: 'unknown_mandate' };
  }

  if (row.status !== newStatus) {
    const { error: updErr } = await sb
      .from('gocardless_mandates')
      .update({ status: newStatus })
      .eq('id', row.id);
    if (updErr) throw updErr;
  }

  if (newStatus === 'active' && row.status !== 'active') {
    await notifyMandateActive({
      org_id: row.org_id,
      tenancy_id: row.tenancy_id,
      tenant_user_id: row.tenant_user_id,
    });
  } else if (
    (newStatus === 'cancelled' || newStatus === 'failed' || newStatus === 'expired') &&
    !['cancelled', 'failed', 'expired'].includes(row.status)
  ) {
    await notifyMandateFailed({
      org_id: row.org_id,
      tenancy_id: row.tenancy_id,
      tenant_user_id: row.tenant_user_id,
    });
  }

  return { event_id: event.id, applied: true, kind: 'mandate_updated' };
}

async function applyPaymentEvent(event: GcWebhookEvent): Promise<EventApplyResult> {
  const gcPaymentId = event.links.payment;
  if (!gcPaymentId) {
    return { event_id: event.id, applied: false, kind: 'noop', reason: 'no_payment_link' };
  }
  const newStatus = mapPaymentActionToStatus(event.action);
  if (!newStatus) {
    log().debug({ action: event.action, eventId: event.id }, 'unknown payment action');
    return { event_id: event.id, applied: false, kind: 'noop', reason: 'unknown_action' };
  }

  const sb = createServiceClient();
  const { data: row, error } = await sb
    .from('rent_payments')
    .select('id, org_id, tenancy_id, charge_id, amount_pence, status')
    .eq('external_id', gcPaymentId)
    .maybeSingle();
  if (error) throw error;
  if (!row) {
    log().warn({ gcPaymentId, eventId: event.id }, 'payment webhook for unknown row');
    return { event_id: event.id, applied: false, kind: 'noop', reason: 'unknown_payment' };
  }

  // No-op transitions (e.g. duplicate confirmation events).
  if (row.status === newStatus) {
    return { event_id: event.id, applied: true, kind: 'payment_updated', reason: 'no_change' };
  }

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'confirmed') {
    updatePayload.paid_at = new Date().toISOString();
  }
  if (newStatus === 'failed' || newStatus === 'charged_back') {
    updatePayload.notes = `gc_cause:${event.details.cause ?? 'unknown'}`;
  }

  const { error: updErr } = await sb.from('rent_payments').update(updatePayload).eq('id', row.id);
  if (updErr) throw updErr;

  // Apply the payment to its parent charge(s) FIFO when confirmed.
  if (newStatus === 'confirmed') {
    const { error: applyErr } = await sb.rpc('apply_payment_to_charges', {
      p_payment_id: row.id,
    });
    if (applyErr) {
      log().error({ err: applyErr, paymentId: row.id }, 'apply_payment_to_charges rpc failed');
    }
  }

  // Reopen the parent charge if a previously-confirmed payment got
  // charged back. Phase E's apply_payment_to_charges only adds; a full
  // un-apply would need its own RPC. For MVP we simply mark the charge
  // as overdue if the chargeback brings outstanding > 0.
  if (newStatus === 'charged_back' && row.charge_id) {
    const { data: charge } = await sb
      .from('rent_charges')
      .select('paid_pence, amount_pence')
      .eq('id', row.charge_id)
      .maybeSingle();
    if (charge && charge.paid_pence >= row.amount_pence) {
      await sb
        .from('rent_charges')
        .update({
          paid_pence: charge.paid_pence - row.amount_pence,
          status: 'overdue',
        })
        .eq('id', row.charge_id);
    }
  }

  // Notification fan-out.
  const ctx = {
    org_id: row.org_id,
    tenancy_id: row.tenancy_id,
    tenant_user_id: await resolveTenantUserId(row.tenancy_id),
  };
  if (newStatus === 'confirmed') {
    await notifyRentPaid({ ctx, amountPence: row.amount_pence });
  } else if (newStatus === 'failed' || newStatus === 'charged_back') {
    await notifyRentFailed({
      ctx,
      amountPence: row.amount_pence,
      cause: event.details.cause ?? null,
    });
  }

  return { event_id: event.id, applied: true, kind: 'payment_updated' };
}

async function resolveTenantUserId(tenancyId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('tenancies')
    .select('tenant_user_id')
    .eq('id', tenancyId)
    .maybeSingle();
  return (data?.tenant_user_id as string | null) ?? null;
}
