import type { RentChargeStatus } from '@/core/schemas/rent';
import { cn } from '@/lib/cn';
import { rentStatusDisplay } from '../status-display';

/**
 * Pill badge for rent_charge status (Upcoming/Due/Paid/Overdue/...).
 */
export function RentStatusBadge({
  status,
  className,
}: {
  status: RentChargeStatus;
  className?: string;
}) {
  const display = rentStatusDisplay(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        display.tone,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', display.dot)} aria-hidden="true" />
      {display.label}
    </span>
  );
}
