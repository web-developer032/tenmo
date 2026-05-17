import type { RentChargeStatus, RentPaymentMethod } from '@/core/schemas/rent';

/**
 * Centralised display tokens for the rent ledger UI.
 * Keep all visual choices here so widgets stay consistent.
 */
export type RentStatusDisplay = {
  label: string;
  tone: string;
  dot: string;
  helper: string;
};

const STATUS: Record<RentChargeStatus, RentStatusDisplay> = {
  upcoming: {
    label: 'Upcoming',
    tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20',
    dot: 'bg-blue-500',
    helper: 'Not yet due.',
  },
  due: {
    label: 'Due',
    tone: 'bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30',
    dot: 'bg-amber-500',
    helper: 'Awaiting payment.',
  },
  partially_paid: {
    label: 'Part paid',
    tone: 'bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30',
    dot: 'bg-amber-500',
    helper: 'Some, but not all, paid.',
  },
  overdue: {
    label: 'Overdue',
    tone: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-red-500/30',
    dot: 'bg-red-500',
    helper: 'Past due — chase or escalate.',
  },
  paid: {
    label: 'Paid',
    tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20',
    dot: 'bg-emerald-500',
    helper: 'Fully settled.',
  },
  waived: {
    label: 'Waived',
    tone: 'bg-muted text-muted-foreground ring-1 ring-border',
    dot: 'bg-zinc-400',
    helper: 'Marked as not collectable.',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'bg-muted text-muted-foreground ring-1 ring-border',
    dot: 'bg-zinc-400',
    helper: 'Cancelled before collection.',
  },
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
