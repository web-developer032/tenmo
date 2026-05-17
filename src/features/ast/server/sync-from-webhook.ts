import 'server-only';
import { checkAndActivateTenancy } from '@/features/tenancies/server';
import type { DocuSealWebhookEvent } from '@/lib/docuseal/types';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { notifyAstDeclined, notifyAstExpired, notifyAstSent, notifyAstSigned } from './notify-ast';
import {
  extractDeclineReason,
  mapDocuSealEventToStatus,
  signedDocumentUrl,
  signUrlFor,
} from './webhook-mapping';

/**
 * Apply a verified DocuSeal webhook event to local state.
 *
 * Idempotency lives in the route handler (we record envelopes in
 * `webhook_events` keyed by `docuseal:<event>:<submission>:<ts>`
 * before calling here), so this function is free to be called more
 * than once and should converge.
 *
 * Side effects per status:
 *
 *   - `sent`       → if no row yet, no-op (we created the row at
 *                    submission time). Update sign URLs in case
 *                    DocuSeal regenerated them.
 *   - `opened`     → set status='opened' + opened_at if not already
 *                    past it.
 *   - `completed`  → set status='completed' + signed_at + document_path,
 *                    fire `notifyAstSigned`, then `checkAndActivateTenancy`.
 *                    The DB trigger stamps `tenancies.ast_signed_at`.
 *   - `declined`   → set status='declined' + declined_at + reason,
 *                    fire `notifyAstDeclined`.
 *   - `expired`    → set status='expired' + expired_at,
 *                    fire `notifyAstExpired`.
 *
 * "Once completed, always signed" — we never roll back a `signed_at`
 * on a later event.
 */
export async function applyDocuSealEvent(event: DocuSealWebhookEvent): Promise<void> {
  const log = getLogger().child({ module: 'ast.webhook', event_type: event.event_type });
  const sb = createServiceClient();

  const submissionId = event.data?.id != null ? String(event.data.id) : null;
  if (!submissionId) {
    log.warn({ event }, 'docuseal event missing submission id; skipping');
    return;
  }

  const { data: envelope, error } = await sb
    .from('ast_envelopes')
    .select('id, org_id, tenancy_id, status, signed_at')
    .eq('docuseal_submission_id', submissionId)
    .maybeSingle();
  if (error) {
    log.error({ err: error, submissionId }, 'failed to lookup envelope');
    return;
  }
  if (!envelope) {
    log.warn({ submissionId }, 'no local envelope for submission; webhook ignored');
    return;
  }

  const newStatus = mapDocuSealEventToStatus(event.event_type);
  if (!newStatus) return;

  const { data: tenancy } = await sb
    .from('tenancies')
    .select('id, org_id, tenant_user_id')
    .eq('id', envelope.tenancy_id)
    .maybeSingle();
  if (!tenancy) {
    log.warn({ tenancy_id: envelope.tenancy_id }, 'envelope has no tenancy; skipping');
    return;
  }

  const recipient = {
    org_id: tenancy.org_id,
    tenancy_id: tenancy.id,
    tenant_user_id: tenancy.tenant_user_id,
  };

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: newStatus };

  switch (newStatus) {
    case 'opened':
      update.opened_at = now;
      break;
    case 'completed':
      // Once signed, always signed — never overwrite a later
      // event onto a completed envelope.
      if (envelope.status === 'completed') return;
      update.signed_at = event.data.completed_at ?? now;
      update.document_path = signedDocumentUrl(event.data) ?? null;
      break;
    case 'declined':
      update.declined_at = now;
      update.decline_reason = extractDeclineReason(event.data);
      break;
    case 'expired':
      update.expired_at = now;
      break;
    case 'sent': {
      // Refresh sign URLs in case DocuSeal regenerated them.
      const ll = signUrlFor(event.data, 'landlord');
      const tn = signUrlFor(event.data, 'tenant');
      if (ll) update.landlord_sign_url = ll;
      if (tn) update.tenant_sign_url = tn;
      break;
    }
  }

  const { error: updErr } = await sb.from('ast_envelopes').update(update).eq('id', envelope.id);
  if (updErr) {
    log.error({ err: updErr, envelope_id: envelope.id }, 'envelope update failed');
    return;
  }

  switch (newStatus) {
    case 'sent':
      await notifyAstSent(recipient);
      break;
    case 'completed':
      await notifyAstSigned(recipient);
      // Chain into activation. checkAndActivateTenancy is
      // intrinsically idempotent and a no-op when other
      // prerequisites are missing.
      try {
        await checkAndActivateTenancy(tenancy.id);
      } catch (err) {
        log.error({ err, tenancy_id: tenancy.id }, 'check-and-activate failed');
      }
      break;
    case 'declined':
      await notifyAstDeclined(recipient, (update.decline_reason as string | null) ?? null);
      break;
    case 'expired':
      await notifyAstExpired(recipient);
      break;
  }
}
