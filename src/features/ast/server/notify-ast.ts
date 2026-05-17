import 'server-only';
import { publishNotification } from '@/features/notifications/server';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Best-effort AST notification fan-out. Wraps `publishNotification`
 * with the AST-specific copy. Always logs failures, never throws —
 * a notification failure must not block webhook reconciliation or
 * the underlying landlord action.
 */

const log = () => getLogger().child({ module: 'ast.notify' });

interface AstRecipientCtx {
  org_id: string;
  tenancy_id: string;
  tenant_user_id: string | null;
}

async function tryPublish(args: Parameters<typeof publishNotification>[0]): Promise<void> {
  try {
    await publishNotification(args);
  } catch (err) {
    log().warn({ err, user_id: args.user_id, kind: args.kind }, 'notification fan-out failed');
  }
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

export async function notifyAstSent(ctx: AstRecipientCtx): Promise<void> {
  if (ctx.tenant_user_id) {
    await tryPublish({
      user_id: ctx.tenant_user_id,
      kind: 'ast_sent',
      title: 'Tenancy agreement to sign',
      body: 'Your landlord has sent the tenancy agreement (AST) for signing.',
      link_url: `/tenant/rent/${ctx.tenancy_id}`,
      entity_type: 'ast_envelope',
      entity_id: ctx.tenancy_id,
    });
  }
  for (const ownerId of await loadOrgOwnerIds(ctx.org_id)) {
    await tryPublish({
      user_id: ownerId,
      kind: 'ast_sent',
      title: 'AST sent for signing',
      body: 'You sent the tenancy agreement to the tenant. We will let you know when both parties sign.',
      link_url: `/landlord`,
      entity_type: 'ast_envelope',
      entity_id: ctx.tenancy_id,
    });
  }
}

export async function notifyAstSigned(ctx: AstRecipientCtx): Promise<void> {
  if (ctx.tenant_user_id) {
    await tryPublish({
      user_id: ctx.tenant_user_id,
      kind: 'ast_signed',
      title: 'Tenancy agreement signed',
      body: 'You and your landlord have signed the tenancy agreement.',
      link_url: `/tenant/rent/${ctx.tenancy_id}`,
      entity_type: 'ast_envelope',
      entity_id: ctx.tenancy_id,
    });
  }
  for (const ownerId of await loadOrgOwnerIds(ctx.org_id)) {
    await tryPublish({
      user_id: ownerId,
      kind: 'ast_signed',
      title: 'AST signed by both parties',
      body: 'The tenancy agreement is now in force. The tenancy will activate once all other prerequisites are met.',
      link_url: `/landlord`,
      entity_type: 'ast_envelope',
      entity_id: ctx.tenancy_id,
    });
  }
}

export async function notifyAstDeclined(
  ctx: AstRecipientCtx,
  reason: string | null,
): Promise<void> {
  const body = reason
    ? `The AST was declined. Reason: "${reason}". Re-send a revised copy when ready.`
    : 'The AST was declined. Re-send a revised copy when ready.';
  for (const ownerId of await loadOrgOwnerIds(ctx.org_id)) {
    await tryPublish({
      user_id: ownerId,
      kind: 'ast_declined',
      title: 'AST declined',
      body,
      link_url: `/landlord`,
      entity_type: 'ast_envelope',
      entity_id: ctx.tenancy_id,
    });
  }
}

export async function notifyAstExpired(ctx: AstRecipientCtx): Promise<void> {
  for (const ownerId of await loadOrgOwnerIds(ctx.org_id)) {
    await tryPublish({
      user_id: ownerId,
      kind: 'ast_expired',
      title: 'AST expired before signing',
      body: 'The tenancy agreement expired before both parties signed. Send a fresh copy when ready.',
      link_url: `/landlord`,
      entity_type: 'ast_envelope',
      entity_id: ctx.tenancy_id,
    });
  }
}
