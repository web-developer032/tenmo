import { ArrowRight, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TICKET_CATEGORY_RULES } from '@/core/constants/tickets';
import { isTerminalStatus } from '@/core/utils/ticket-rules';
import type { TicketWithContext } from '../loaders';
import { ticketSeverityDisplay, ticketStatusDisplay } from '../status-display';

/**
 * Compact maintenance summary used on the tenant dashboard.
 *
 * Shows:
 *   - "Raise an issue" CTA (always)
 *   - The 3 most recent open tickets
 *   - A link to the full list when there's more
 *
 * Hides itself if the tenant has no active tenancies (the parent decides whether
 * to render at all). When the tenant has tenancies but no tickets we still show
 * the friendly "no open issues" empty state — it's reassuring, not noise.
 */
export function TenantMaintenanceSummary({
  tickets,
  hasActiveTenancy,
}: {
  tickets: TicketWithContext[];
  hasActiveTenancy: boolean;
}) {
  const open = tickets.filter((t) => !isTerminalStatus(t.status) && t.status !== 'resolved');
  const recent = tickets.slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            Maintenance
          </CardTitle>
          <CardDescription>
            {open.length === 0
              ? 'No open issues right now — happy days.'
              : `${open.length} open ${open.length === 1 ? 'issue' : 'issues'} on the go.`}
          </CardDescription>
        </div>
        {hasActiveTenancy ? (
          <Button asChild size="sm">
            <Link href="/tenant/tickets/new">Raise an issue</Link>
          </Button>
        ) : null}
      </CardHeader>

      {recent.length > 0 ? (
        <CardContent className="space-y-2 pt-0">
          <ul className="divide-y rounded-md border">
            {recent.map((t) => {
              const status = ticketStatusDisplay(t.status);
              const severity = ticketSeverityDisplay(t.severity);
              return (
                <li key={t.id}>
                  <Link
                    href={`/tenant/tickets/${t.id}`}
                    className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {TICKET_CATEGORY_RULES[t.category].label}
                        {t.property_name ? ` · ${t.property_name}` : ''}
                        {t.room_name ? ` · ${t.room_name}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${severity.tone}`}
                      >
                        {severity.label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.tone}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {tickets.length > recent.length ? (
            <Link
              href="/tenant/tickets"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all {tickets.length} tickets <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
