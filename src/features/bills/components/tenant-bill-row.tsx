import { BILL_TYPE_LABEL, type BillType } from '@/core/constants/bills';
import { formatMoney } from '@/core/utils/money';

/**
 * Compact tenant-facing bill row. Shows the bill type, period, and
 * the tenant's share. For `included_in_rent` bills we show
 * "Included in rent" instead of an amount.
 */
export function TenantBillRow({
  type,
  period_start,
  period_end,
  amount_pence,
  allocation_method,
}: {
  type: BillType;
  period_start: string;
  period_end: string;
  amount_pence: number;
  allocation_method: 'equal_per_room' | 'by_share' | 'included_in_rent' | 'landlord_pays';
}) {
  const isInfo = allocation_method === 'included_in_rent';
  return (
    <div className="flex items-center justify-between border-b border-border-soft py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="font-semibold text-ink">{BILL_TYPE_LABEL[type]}</div>
        <div className="text-xs text-ink-light">
          {period_start} → {period_end}
        </div>
      </div>
      <div className="text-right">
        {isInfo ? (
          <span className="text-xs font-semibold text-forest-600">Included in rent</span>
        ) : (
          <span className="font-semibold tabular-nums text-ink">{formatMoney(amount_pence)}</span>
        )}
      </div>
    </div>
  );
}
