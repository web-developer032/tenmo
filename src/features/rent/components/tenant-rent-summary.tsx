import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { RentCharge } from '@/core/schemas/rent';
import { formatMoney } from '@/core/utils/money';
import { groupChargesByTime, totalArrearsPence } from '@/core/utils/rent-rules';
import { ChargeRow } from './charge-row';

/**
 * Compact rent summary for the tenant dashboard.
 * Shows arrears (if any), the next 1-2 charges, and a deep link to the
 * full ledger.
 */
export function TenantRentSummary({
  tenancyId,
  charges,
}: {
  tenancyId: string;
  charges: RentCharge[];
}) {
  if (charges.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        No rent activity yet. Your landlord hasn&apos;t issued the first charge — they&apos;ll
        appear here automatically.
      </div>
    );
  }

  const grouped = groupChargesByTime(charges);
  const arrears = totalArrearsPence(charges);
  const upcomingFirst = [...grouped.overdue, ...grouped.due, ...grouped.upcoming].slice(0, 2);

  return (
    <div className="space-y-3 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Rent</div>
          <div
            className={`text-lg font-semibold ${
              arrears > 0
                ? 'text-red-700 dark:text-red-300'
                : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {arrears > 0 ? `${formatMoney(arrears)} outstanding` : 'You\u2019re up to date'}
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/tenant/rent/${tenancyId}`}>View ledger</Link>
        </Button>
      </div>
      {upcomingFirst.length > 0 ? (
        <div className="space-y-2">
          {upcomingFirst.map((c) => (
            <ChargeRow key={c.id} charge={c} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
