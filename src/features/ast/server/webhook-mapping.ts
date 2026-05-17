import type { AstEnvelopeStatus } from '@/core/constants/ast';
import type {
  DocuSealEventType,
  DocuSealSubmission,
  DocuSealSubmissionStatus,
  DocuSealSubmitter,
} from '@/lib/docuseal/types';

/**
 * Pure mapping helpers for DocuSeal webhook events. Extracted from
 * `sync-from-webhook.ts` so they can be unit-tested without mocking
 * Supabase / DocuSeal.
 *
 * Per docs/05-backend/webhooks-and-integrations.md:
 *   submission.created   → status='sent'
 *   submission.opened    → status='opened' + opened_at
 *   submission.completed → status='completed' + signed_at
 *   submission.declined  → status='declined' + declined_at + decline_reason
 *   submission.expired   → status='expired' + expired_at
 */

export function mapDocuSealEventToStatus(event: DocuSealEventType): AstEnvelopeStatus | null {
  switch (event) {
    case 'submission.created':
      return 'sent';
    case 'submission.opened':
      return 'opened';
    case 'submission.completed':
      return 'completed';
    case 'submission.declined':
      return 'declined';
    case 'submission.expired':
      return 'expired';
    default:
      return null;
  }
}

/** Map a DocuSeal-side submission status (returned from `getSubmission`)
 * to ours. Used when we re-read the submission to drift-correct. */
export function mapDocuSealSubmissionStatus(s: DocuSealSubmissionStatus): AstEnvelopeStatus {
  switch (s) {
    case 'pending':
      return 'sent';
    case 'opened':
      return 'opened';
    case 'completed':
      return 'completed';
    case 'declined':
      return 'declined';
    case 'expired':
      return 'expired';
    default:
      return 'sent';
  }
}

/** Pull the first decline reason off a submission's submitters array.
 * DocuSeal puts the reason on whichever submitter declined; we don't
 * care which side. Returns null when no reason is present. */
export function extractDeclineReason(submission: DocuSealSubmission): string | null {
  for (const s of submission.submitters ?? []) {
    if (s.status === 'declined' && s.decline_reason) {
      return s.decline_reason;
    }
  }
  return null;
}

/** Find the submitter URL for a given role. Either `embed_src` or
 * `url` may be present depending on DocuSeal version. Returns null if
 * the role isn't represented or no URL is set. */
export function signUrlFor(
  submission: DocuSealSubmission,
  role: 'landlord' | 'tenant',
): string | null {
  const submitter = (submission.submitters ?? []).find(
    (s: DocuSealSubmitter) => (s.role ?? '').toLowerCase() === role,
  );
  if (!submitter) return null;
  return submitter.embed_src ?? submitter.url ?? null;
}

/** Best-guess merged-PDF URL from the submission. Either the
 * audit_log_url or the first document URL. */
export function signedDocumentUrl(submission: DocuSealSubmission): string | null {
  if (submission.audit_log_url) return submission.audit_log_url;
  const doc = submission.documents?.[0];
  return doc?.url ?? null;
}
