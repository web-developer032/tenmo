import type { RentPaymentMethod, RentPaymentStatus } from '@/core/schemas/rent';
import { formatMoney } from '@/core/utils/money';
import { rentMethodLabel } from '../status-display';

type PaymentRowInput = {
  id: string;
  amount_pence: number;
  method: RentPaymentMethod;
  status: RentPaymentStatus;
  paid_at: string | null;
  notes: string | null;
};

const STATUS_TONE: Record<RentPaymentStatus, string> = {
  pending: 'text-amber-700 dark:text-amber-300',
  confirmed: 'text-emerald-700 dark:text-emerald-300',
  failed: 'text-red-700 dark:text-red-300',
  charged_back: 'text-red-700 dark:text-red-300',
  refunded: 'text-zinc-500',
};

/**
 * Single rent_payment row for the tenancy ledger.
 */
export function PaymentRow({ payment }: { payment: PaymentRowInput }) {
  const paidOn = payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('en-GB') : '—';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{formatMoney(payment.amount_pence)}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {rentMethodLabel(payment.method)} · {paidOn}
          {payment.notes ? <span> · {payment.notes}</span> : null}
        </div>
      </div>
      <div className={`text-xs font-medium uppercase ${STATUS_TONE[payment.status]}`}>
        {payment.status.replace('_', ' ')}
      </div>
    </div>
  );
}
