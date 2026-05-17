/**
 * AST e-sign domain — DocuSeal envelope state + party roles.
 *
 * No DocuSeal SDK imports here. The status enum mirrors the
 * `ast_envelope_status` Postgres enum in
 * `20260101001900_ast_envelopes.sql`.
 */

export type AstEnvelopeStatus =
  | 'sent'
  | 'opened'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'cancelled';

export const AST_ENVELOPE_STATUS_VALUES: AstEnvelopeStatus[] = [
  'sent',
  'opened',
  'completed',
  'declined',
  'expired',
  'cancelled',
];

/** UI label per status. */
export const AST_STATUS_LABEL: Record<AstEnvelopeStatus, string> = {
  sent: 'Awaiting signatures',
  opened: 'Opened by signer',
  completed: 'Signed',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

/** Tone for the badge component. */
export const AST_STATUS_TONE: Record<
  AstEnvelopeStatus,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  sent: 'warning',
  opened: 'warning',
  completed: 'success',
  declined: 'destructive',
  expired: 'secondary',
  cancelled: 'secondary',
};

/** True for statuses where neither party can take any action — UI
 * should offer a "Send new AST" CTA to the landlord. */
export const AST_STATUS_TERMINAL: Record<AstEnvelopeStatus, boolean> = {
  sent: false,
  opened: false,
  completed: true,
  declined: true,
  expired: true,
  cancelled: true,
};

/** True when the envelope can still be signed (the tenant action). */
export const AST_STATUS_OPEN: Record<AstEnvelopeStatus, boolean> = {
  sent: true,
  opened: true,
  completed: false,
  declined: false,
  expired: false,
  cancelled: false,
};

/** Signer roles inside a DocuSeal submission. We use exactly two
 * roles for AST: the landlord (sender) and the tenant. */
export type AstSignerRole = 'landlord' | 'tenant';

export const AST_SIGNER_ROLES: AstSignerRole[] = ['landlord', 'tenant'];

export const AST_SIGNER_LABEL: Record<AstSignerRole, string> = {
  landlord: 'Landlord',
  tenant: 'Tenant',
};

/** Per-status copy used on the tenancy activation checklist + status
 * card. Helps avoid duplicating natural-language strings across UI
 * components. */
export const AST_STATUS_DESCRIPTION: Record<AstEnvelopeStatus, string> = {
  sent: 'Tenancy agreement sent — waiting for both parties to sign.',
  opened: 'Tenancy agreement has been opened — signature pending.',
  completed: 'Tenancy agreement is signed by both parties.',
  declined: 'Tenancy agreement was declined. The landlord can revise the terms and re-send.',
  expired:
    'Tenancy agreement expired before both parties signed. The landlord can re-send a fresh copy.',
  cancelled: 'The landlord cancelled this signing run.',
};
