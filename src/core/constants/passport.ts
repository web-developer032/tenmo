/**
 * Rental Passport — section identifiers, labels, and payment
 * timeliness bands.
 *
 * The product brief says "show bands not absolute counts" so a
 * tenant with one missed payment in their first 12 months isn't
 * permanently stigmatised. See docs/07-flows/13-rental-passport.md.
 */

export type PassportSection = 'identity' | 'right_to_rent' | 'tenancies' | 'payments' | 'documents';

export const PASSPORT_SECTION_VALUES: PassportSection[] = [
  'identity',
  'right_to_rent',
  'tenancies',
  'payments',
  'documents',
];

export const PASSPORT_SECTION_LABEL: Record<PassportSection, string> = {
  identity: 'Identity',
  right_to_rent: 'Right to Rent',
  tenancies: 'Tenancy history',
  payments: 'Payment record',
  documents: 'Documents',
};

export const PASSPORT_SECTION_DESCRIPTION: Record<PassportSection, string> = {
  identity: 'Your name and contact details, taken from your Tenantly profile.',
  right_to_rent: 'Your landlord-recorded Right to Rent check (UK statutory requirement).',
  tenancies: 'Properties you have rented through Tenantly, with dates and rent.',
  payments: 'Aggregated rent payment record across all your tenancies (banded for fairness).',
  documents: 'Signed ASTs and any documents your landlord has shared with you.',
};

/**
 * Payment timeliness bands. We only show the band, not "X out of Y
 * paid late" — Airbnb-style fairness.
 */
export type PaymentBand = 'excellent' | 'reliable' | 'mixed' | 'building' | 'no_record';

export const PAYMENT_BAND_LABEL: Record<PaymentBand, string> = {
  excellent: 'Excellent — every rent paid on time',
  reliable: 'Reliable — almost always on time',
  mixed: 'Mixed — some payments late',
  building: 'Building a record — too few payments to band yet',
  no_record: 'No payment record yet',
};

export const PAYMENT_BAND_BLURB: Record<PaymentBand, string> = {
  excellent:
    'Tenant has paid every rent charge on or before the due date across their entire tenancy history with Tenantly.',
  reliable:
    'Tenant has paid 90%+ of rent charges on time. Late payments were occasional and small.',
  mixed:
    'Tenant has had a notable share of late payments. Recent payment behaviour may differ — check the date range.',
  building:
    'This tenant is new to Tenantly and has fewer than three months of payment history. Treat as unrated.',
  no_record: 'No rent has been collected for this tenant through Tenantly yet.',
};

/** Threshold for the `building` band — fewer than this many paid
 * charges and we don't display a numeric band. */
export const PAYMENT_BAND_MIN_CHARGES = 3;
/** ≥ this share of on-time payments → `excellent`. */
export const PAYMENT_BAND_EXCELLENT_THRESHOLD = 1.0;
/** ≥ this share of on-time payments → `reliable`. */
export const PAYMENT_BAND_RELIABLE_THRESHOLD = 0.9;

/**
 * Right to Rent display state. We mirror the underlying
 * `compliance_items.status` values for `right_to_rent` items so the
 * passport always tracks the system of record.
 */
export type RtrDisplayStatus = 'verified' | 'pending' | 'expired' | 'not_recorded';

export const RTR_STATUS_LABEL: Record<RtrDisplayStatus, string> = {
  verified: 'Right to Rent verified',
  pending: 'Right to Rent check in progress',
  expired: 'Right to Rent check expired',
  not_recorded: 'Right to Rent not yet checked',
};
