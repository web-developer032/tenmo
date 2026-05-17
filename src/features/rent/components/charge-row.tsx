import type { RentCharge } from '@/core/schemas/rent';
import { formatMoney } from '@/core/utils/money';
import {
  chargeOutstandingPence,
  deriveChargeStatus,
  humaniseDueDate,
} from '@/core/utils/rent-rules';
import { RentStatusBadge } from './rent-status-badge';

/**
 * Single rent_charge row, used in the tenancy ledger and tenant dashboard.
 *
 * `actions` is an optional render slot for trailing controls — the
 * landlord rent ledger uses it to drop in a `CollectNowButton` for
 * tenancies with an active GoCardless mandate. Tenant + dashboard
 * call sites pass nothing.
 */
export function ChargeRow({ charge, actions }: { charge: RentCharge; actions?: React.ReactNode }) {
  const derived = deriveChargeStatus(charge);
  const outstanding = chargeOutstandingPence(charge);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {formatMoney(charge.amount_pence)}{' '}
            <span className="text-muted-foreground">due {charge.due_date}</span>
          </span>
          <RentStatusBadge status={derived} />
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {humaniseDueDate(charge)}
          {charge.paid_pence > 0 && charge.paid_pence < charge.amount_pence ? (
            <span> · {formatMoney(charge.paid_pence)} paid</span>
          ) : null}
          {outstanding > 0 && derived !== 'paid' ? (
            <span> · {formatMoney(outstanding)} outstanding</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3 text-right text-xs text-muted-foreground">
        <span>
          {charge.period_start} → {charge.period_end}
        </span>
        {actions}
      </div>
    </div>
  );
}
