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
  pending: 'text-amber',
  confirmed: 'text-forest-600',
  failed: 'text-alert',
  charged_back: 'text-alert',
  refunded: 'text-ink-light',
};

/**
 * Single rent_payment row for the tenancy ledger.
 */
export function PaymentRow({ payment }: { payment: PaymentRowInput }) {
  const paidOn = payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('en-GB') : '—';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-button border border-border-soft bg-white p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink">{formatMoney(payment.amount_pence)}</div>
        <div className="mt-0.5 text-xs text-ink-light">
          {rentMethodLabel(payment.method)} · {paidOn}
          {payment.notes ? <span> · {payment.notes}</span> : null}
        </div>
      </div>
      <div
        className={`text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[payment.status]}`}
      >
        {payment.status.replace('_', ' ')}
      </div>
    </div>
  );
}
