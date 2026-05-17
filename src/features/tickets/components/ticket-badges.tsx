import type { TicketSeverity, TicketStatus } from '@/core/constants/tickets';
import { cn } from '@/lib/cn';
import { ticketSeverityDisplay, ticketStatusDisplay } from '../status-display';

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const d = ticketStatusDisplay(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        d.tone,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', d.dot)} aria-hidden="true" />
      {d.label}
    </span>
  );
}

export function TicketSeverityBadge({
  severity,
  className,
}: {
  severity: TicketSeverity;
  className?: string;
}) {
  const d = ticketSeverityDisplay(severity);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        d.tone,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', d.dot)} aria-hidden="true" />
      {d.label}
    </span>
  );
}
