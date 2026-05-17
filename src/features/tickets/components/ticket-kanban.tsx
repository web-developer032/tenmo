import { TICKET_STATUS_LABEL, type TicketStatus } from '@/core/constants/tickets';
import { cn } from '@/lib/cn';
import type { TicketWithContext } from '../loaders';
import { TicketCard } from './ticket-card';

/**
 * Landlord kanban board.
 *
 * Renders a horizontally-scrolling row of columns — one per active status.
 * Resolved/closed/cancelled live below the board in a separate "history"
 * surface (see `TicketHistory`) so the board stays focussed on work in
 * flight.
 *
 * Each card links to the landlord-scoped detail URL so the parent passes
 * the org slug.
 */
export function TicketKanban({
  byStatus,
  orgSlug,
}: {
  byStatus: Record<string, TicketWithContext[]>;
  orgSlug: string;
}) {
  const COLUMNS: TicketStatus[] = [
    'open',
    'triaged',
    'in_progress',
    'awaiting_tenant',
    'awaiting_contractor',
    'resolved',
  ];

  return (
    <section
      aria-label="Maintenance kanban"
      className="flex w-full snap-x gap-4 overflow-x-auto pb-2"
    >
      {COLUMNS.map((status) => {
        const items = byStatus[status] ?? [];
        return <KanbanColumn key={status} status={status} items={items} orgSlug={orgSlug} />;
      })}
    </section>
  );
}

function KanbanColumn({
  status,
  items,
  orgSlug,
}: {
  status: TicketStatus;
  items: TicketWithContext[];
  orgSlug: string;
}) {
  return (
    <section
      className={cn(
        'flex w-72 shrink-0 snap-start flex-col rounded-lg border bg-muted/30 p-3',
        items.length === 0 && 'opacity-70',
      )}
      aria-label={`${TICKET_STATUS_LABEL[status]} column`}
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {TICKET_STATUS_LABEL[status]}
        </h3>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed bg-background/40 p-3 text-center text-xs text-muted-foreground">
          Nothing here.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id}>
              <TicketCard ticket={t} href={`/landlord/${orgSlug}/maintenance/${t.id}`} showTenant />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
