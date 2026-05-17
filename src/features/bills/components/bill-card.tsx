import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BILL_ALLOCATION_METHOD_LABEL,
  BILL_METHOD_NEEDS_ALLOCATIONS,
} from '@/core/constants/bills';
import type { Bill, BillAllocation } from '@/core/schemas/bills';
import { formatShareBasisPoints } from '@/core/utils/bill-allocations';
import { formatMoney } from '@/core/utils/money';
import { BillTypeBadge } from './bill-type-badge';
import { DeleteBillButton } from './delete-bill-button';

/**
 * Landlord bill card. Renders the bill header + a tidy table of
 * per-room allocations (when applicable). Server component; the
 * delete control is the only client island.
 */
export function BillCard({
  bill,
  allocations,
  rooms,
}: {
  bill: Bill;
  allocations: BillAllocation[];
  rooms: ReadonlyArray<{ id: string; name: string }>;
}) {
  const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));
  const showAllocations = BILL_METHOD_NEEDS_ALLOCATIONS[bill.allocation_method];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <BillTypeBadge type={bill.type} />
            {formatMoney(bill.total_pence)}
            <span className="text-xs font-normal text-muted-foreground">
              {bill.period_start} → {bill.period_end}
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {bill.provider ? `${bill.provider} · ` : ''}
            {BILL_ALLOCATION_METHOD_LABEL[bill.allocation_method]}
          </p>
        </div>
        <DeleteBillButton billId={bill.id} />
      </CardHeader>
      {showAllocations && allocations.length > 0 ? (
        <CardContent className="space-y-1 text-sm">
          {allocations.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border-b border-border/50 py-1 last:border-b-0"
            >
              <span className="text-foreground/90">
                {roomNameById.get(a.room_id) ?? 'Room'}
                {a.share_basis_points != null ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({formatShareBasisPoints(a.share_basis_points)})
                  </span>
                ) : null}
              </span>
              <span className="font-medium tabular-nums">{formatMoney(a.amount_pence)}</span>
            </div>
          ))}
        </CardContent>
      ) : null}
      {bill.notes ? (
        <CardContent className="border-t pt-3 text-xs text-muted-foreground">
          {bill.notes}
        </CardContent>
      ) : null}
    </Card>
  );
}
