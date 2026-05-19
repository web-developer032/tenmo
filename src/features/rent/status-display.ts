import { TONE, type ToneName } from '@/components/ds/status-tone';
import type { RentChargeStatus, RentPaymentMethod } from '@/core/schemas/rent';

/**
 * Centralised display tokens for the rent ledger UI.
 * Keep all visual choices here so widgets stay consistent.
 */
export type RentStatusDisplay = {
  label: string;
  toneName: ToneName;
  tone: string;
  dot: string;
  helper: string;
};

function row(label: string, toneName: ToneName, helper: string): RentStatusDisplay {
  return { label, toneName, tone: TONE[toneName].chip, dot: TONE[toneName].dot, helper };
}

const STATUS: Record<RentChargeStatus, RentStatusDisplay> = {
  upcoming: row('Upcoming', 'blue', 'Not yet due.'),
  due: row('Due', 'amber', 'Awaiting payment.'),
  partially_paid: row('Part paid', 'amber', 'Some, but not all, paid.'),
  overdue: row('Overdue', 'alert', 'Past due — chase or escalate.'),
  paid: row('Paid', 'forest', 'Fully settled.'),
  waived: row('Waived', 'neutral', 'Marked as not collectable.'),
  cancelled: row('Cancelled', 'neutral', 'Cancelled before collection.'),
};

export function rentStatusDisplay(status: RentChargeStatus): RentStatusDisplay {
  return STATUS[status] ?? STATUS.upcoming;
}

const METHOD_LABEL: Record<RentPaymentMethod, string> = {
  manual_bank_transfer: 'Bank transfer',
  manual_cash: 'Cash',
  manual_card: 'Card',
  manual_other: 'Other (manual)',
  gocardless_dd: 'Direct Debit',
  truelayer_ob: 'Open Banking',
};

export function rentMethodLabel(method: RentPaymentMethod): string {
  return METHOD_LABEL[method] ?? method;
}

export const MANUAL_METHOD_OPTIONS: ReadonlyArray<{ value: RentPaymentMethod; label: string }> = [
  { value: 'manual_bank_transfer', label: 'Bank transfer' },
  { value: 'manual_cash', label: 'Cash' },
  { value: 'manual_card', label: 'Card' },
  { value: 'manual_other', label: 'Other' },
];
