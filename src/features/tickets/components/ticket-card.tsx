import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TICKET_CATEGORY_RULES } from '@/core/constants/tickets';
import type { Ticket } from '@/core/schemas/ticket';
import { cn } from '@/lib/cn';
import { ticketSeverityDisplay, ticketStatusDisplay } from '../status-display';

export type TicketCardCtx = Ticket & {
  property_name: string | null;
  room_name: string | null;
  tenant_name?: string | null;
};

/**
 * Compact ticket tile used in the kanban board and tenant list.
 *
 * `href` controls where clicks go — landlord and tenant pages live in
 * different routes so the parent passes the right URL.
 */
export function TicketCard({
  ticket,
  href,
  showTenant = false,
}: {
  ticket: TicketCardCtx;
  href: string;
  showTenant?: boolean;
}) {
  const status = ticketStatusDisplay(ticket.status);
  const severity = ticketSeverityDisplay(ticket.severity);
  const category = TICKET_CATEGORY_RULES[ticket.category].label;

  return (
    <Link href={href} className="block focus:outline-none">
      <Card className="transition hover:border-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring">
        <CardHeader className="space-y-1.5 pb-2">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                severity.tone,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', severity.dot)} aria-hidden />
              {severity.label}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                status.tone,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden />
              {status.label}
            </span>
          </div>
          <CardTitle className="line-clamp-2 text-sm font-semibold">{ticket.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-0 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3 w-3" />
            <span>{category}</span>
          </div>
          <div className="line-clamp-1">
            {ticket.property_name ?? 'Property'}
            {ticket.room_name ? ` · ${ticket.room_name}` : ''}
          </div>
          {showTenant && ticket.tenant_name ? (
            <div className="line-clamp-1">{ticket.tenant_name}</div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
