import 'server-only';
import type { NotificationKind } from '@/core/constants/notifications';
import { paymentFailureCopy } from '@/core/utils/payment-rules';
import { publishNotification } from '@/features/notifications/server';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Best-effort notifier for payment + mandate lifecycle events.
 *
 * Always logs failures, never throws — a notification failure must not
 * block webhook reconciliation. Wraps `publishNotification` from
 * Phase G with the payment-specific copy.
 */

const log = () => getLogger().child({ module: 'payments.notify' });

async function tryPublish(args: Parameters<typeof publishNotification>[0]): Promise<void> {
  try {
    await publishNotification(args);
  } catch (err) {
    log().warn({ err, user_id: args.user_id, kind: args.kind }, 'notification fan-out failed');
  }
}

interface RentRecipientCtx {
  org_id: string;
  tenancy_id: string;
  tenant_user_id: string | null;
}

async function loadOrgOwnerIds(orgId: string): Promise<string[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('org_memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .in('role', ['owner', 'agent'])
    .is('revoked_at', null);
  return (data ?? []).map((r) => r.user_id);
}

export async function notifyMandateActive(ctx: RentRecipientCtx): Promise<void> {
  const link = `/tenant/rent/${ctx.tenancy_id}`;
  if (ctx.tenant_user_id) {
    await tryPublish({
      user_id: ctx.tenant_user_id,
      kind: 'mandate_active' as NotificationKind,
      title: 'Direct Debit ready',
      body: 'Your rent will be collected automatically each period — you are all set.',
      link_url: link,
      entity_type: 'gocardless_mandate',
      entity_id: ctx.tenancy_id,
    });
  }
  for (const ownerId of await loadOrgOwnerIds(ctx.org_id)) {
    await tryPublish({
      user_id: ownerId,
      kind: 'mandate_active' as NotificationKind,
      title: 'Direct Debit ready',
      body: 'A tenant just confirmed their Direct Debit — you can collect rent automatically.',
      link_url: `/landlord`,
      entity_type: 'gocardless_mandate',
      entity_id: ctx.tenancy_id,
    });
  }
}

export async function notifyMandateFailed(ctx: RentRecipientCtx): Promise<void> {
  const link = `/tenant/rent/${ctx.tenancy_id}`;
  if (ctx.tenant_user_id) {
    await tryPublish({
      user_id: ctx.tenant_user_id,
      kind: 'mandate_failed' as NotificationKind,
      title: 'Direct Debit cancelled',
      body: 'Your Direct Debit was cancelled. Set up a new one to keep automatic rent collection.',
      link_url: link,
      entity_type: 'gocardless_mandate',
      entity_id: ctx.tenancy_id,
    });
  }
  for (const ownerId of await loadOrgOwnerIds(ctx.org_id)) {
    await tryPublish({
      user_id: ownerId,
      kind: 'mandate_failed' as NotificationKind,
      title: 'Direct Debit lost',
      body: "A tenant's Direct Debit is no longer collectable. Ask them to set it up again.",
      link_url: `/landlord`,
      entity_type: 'gocardless_mandate',
      entity_id: ctx.tenancy_id,
    });
  }
}

export async function notifyRentPaid(args: {
  ctx: RentRecipientCtx;
  amountPence: number;
}): Promise<void> {
  const amountGbp = (args.amountPence / 100).toFixed(2);
  if (args.ctx.tenant_user_id) {
    await tryPublish({
      user_id: args.ctx.tenant_user_id,
      kind: 'rent_paid',
      title: 'Rent paid',
      body: `£${amountGbp} was collected from your account.`,
      link_url: `/tenant/rent/${args.ctx.tenancy_id}`,
      entity_type: 'rent_payment',
      entity_id: args.ctx.tenancy_id,
    });
  }
  for (const ownerId of await loadOrgOwnerIds(args.ctx.org_id)) {
    await tryPublish({
      user_id: ownerId,
      kind: 'rent_paid',
      title: 'Rent received',
      body: `£${amountGbp} just landed via Direct Debit.`,
      link_url: `/landlord`,
      entity_type: 'rent_payment',
      entity_id: args.ctx.tenancy_id,
    });
  }
}

export async function notifyRentFailed(args: {
  ctx: RentRecipientCtx;
  amountPence: number;
  cause: string | null;
}): Promise<void> {
  const amountGbp = (args.amountPence / 100).toFixed(2);
  const copy = paymentFailureCopy(args.cause);
  if (args.ctx.tenant_user_id) {
    await tryPublish({
      user_id: args.ctx.tenant_user_id,
      kind: 'rent_failed',
      title: 'Rent payment failed',
      body: `${copy.label}. ${copy.hint}`,
      link_url: `/tenant/rent/${args.ctx.tenancy_id}`,
      entity_type: 'rent_payment',
      entity_id: args.ctx.tenancy_id,
      meta: { cause: copy.reason, amount_pence: args.amountPence },
    });
  }
  for (const ownerId of await loadOrgOwnerIds(args.ctx.org_id)) {
    await tryPublish({
      user_id: ownerId,
      kind: 'rent_failed',
      title: 'Rent payment failed',
      body: `£${amountGbp} could not be collected. ${copy.label}.`,
      link_url: `/landlord`,
      entity_type: 'rent_payment',
      entity_id: args.ctx.tenancy_id,
      meta: { cause: copy.reason, amount_pence: args.amountPence },
    });
  }
}
