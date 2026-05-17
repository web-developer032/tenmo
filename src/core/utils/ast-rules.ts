import {
  AST_STATUS_OPEN,
  AST_STATUS_TERMINAL,
  type AstEnvelopeStatus,
  type AstSignerRole,
} from '../constants/ast';
import type { AstEnvelope } from '../schemas/ast';

/**
 * Pure helpers for the AST envelope domain. No React, no DocuSeal,
 * no Supabase. Trivially unit-testable + portable to Expo.
 */

/** True when the envelope is in a state where the tenant could still
 * sign. Closed envelopes (completed/declined/expired/cancelled) need
 * a fresh send to take any further action. */
export function isEnvelopeOpen(envelope: Pick<AstEnvelope, 'status'> | null | undefined): boolean {
  if (!envelope) return false;
  return AST_STATUS_OPEN[envelope.status];
}

/** True when the envelope is in a terminal state (no further action
 * possible without a new envelope). */
export function isEnvelopeTerminal(
  envelope: Pick<AstEnvelope, 'status'> | null | undefined,
): boolean {
  if (!envelope) return false;
  return AST_STATUS_TERMINAL[envelope.status];
}

/** True for the one status the landlord can still cancel from. */
export function canCancelEnvelope(status: AstEnvelopeStatus): boolean {
  return status === 'sent' || status === 'opened';
}

/** Pick the right sign URL for a given role. Returns null when the
 * envelope is closed or the URL hasn't been minted yet (the "Sign now"
 * button should fall back to a server refresh in that case). */
export function signUrlForRole(
  envelope: Pick<AstEnvelope, 'landlord_sign_url' | 'tenant_sign_url' | 'status'>,
  role: AstSignerRole,
): string | null {
  if (!isEnvelopeOpen(envelope)) return null;
  return role === 'landlord' ? envelope.landlord_sign_url : envelope.tenant_sign_url;
}

/** Returns true when the landlord should see a "Send AST" CTA at
 * all. Any open envelope hides the CTA; only "no envelope yet" or
 * a terminal previous one shows it. */
export function needsAstSent(envelope: Pick<AstEnvelope, 'status'> | null | undefined): boolean {
  if (!envelope) return true;
  return isEnvelopeTerminal(envelope) && envelope.status !== 'completed';
}
