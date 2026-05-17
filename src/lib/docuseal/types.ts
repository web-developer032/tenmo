/**
 * Narrow type definitions for the DocuSeal resources we touch.
 *
 * We hand-roll these (instead of installing a SDK) for the same
 * reasons documented in `lib/gocardless/types.ts`:
 *   - we only call ~3 endpoints, all simple JSON over HTTPS,
 *   - we want to narrow exactly the fields the reconciler needs,
 *   - and keep the Edge bundle tiny.
 *
 * Reference: https://www.docuseal.com/docs/api
 */

export type DocuSealSubmitterRole = 'landlord' | 'tenant' | string;

export interface DocuSealSubmitter {
  id: number | string;
  email: string;
  name?: string | null;
  role?: DocuSealSubmitterRole;
  status: 'pending' | 'opened' | 'sent' | 'completed' | 'declined' | 'expired';
  /** Direct sign URL. Either field name appears across DocuSeal versions. */
  embed_src?: string;
  url?: string;
  signed_at?: string | null;
  opened_at?: string | null;
  declined_at?: string | null;
  decline_reason?: string | null;
}

export type DocuSealSubmissionStatus = 'pending' | 'opened' | 'completed' | 'declined' | 'expired';

export interface DocuSealSubmission {
  id: number | string;
  status: DocuSealSubmissionStatus;
  template_id?: number | string;
  submitters: DocuSealSubmitter[];
  /** When all parties signed; only set for completed envelopes. */
  completed_at?: string | null;
  /** URL of the merged signed PDF (post-completion). */
  audit_log_url?: string | null;
  documents?: Array<{ name?: string; url?: string }>;
  metadata?: Record<string, string> | null;
  expire_at?: string | null;
  created_at: string;
}

export type DocuSealEventType =
  | 'submission.created'
  | 'submission.opened'
  | 'submission.completed'
  | 'submission.declined'
  | 'submission.expired';

/** A webhook payload from DocuSeal. We get one event per HTTP request
 * (unlike GoCardless's envelopes), so the schema is flat. */
export interface DocuSealWebhookEvent {
  event_type: DocuSealEventType;
  timestamp: string;
  data: DocuSealSubmission;
}
