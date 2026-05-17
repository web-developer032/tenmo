import type { ComplianceStatus } from '@/core/constants/compliance';
import { cn } from '@/lib/cn';
import { complianceStatusDisplay } from '../status-display';

/**
 * Pill badge showing the compliance status (Overdue/Due soon/In date/Missing).
 * Used everywhere from the property card to the tenant dashboard.
 */
export function ComplianceStatusBadge({
  status,
  className,
}: {
  status: ComplianceStatus;
  className?: string;
}) {
  const display = complianceStatusDisplay(status);
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
