import { TICKET_CATEGORY_RULES } from '@/core/constants/tickets';
import { cn } from '@/lib/cn';
import type { MaintenanceSnapshotRow } from '../types';

/**
 * "My requests" snapshot on the tenant Home — shows up to two recent
 * tickets with a coloured icon-tile + status chip. Detailed kanban /
 * filtering lives on `/tenant/tickets`.
 */

const ICON_TINT: Record<MaintenanceSnapshotRow['iconTone'], string> = {
  forest: 'bg-foam text-forest-700',
  blue: 'bg-blue-bg text-blue',
  amber: 'bg-amber-bg text-amber',
  alert: 'bg-alert-bg text-alert',
};

const STATUS_CHIP: Record<MaintenanceSnapshotRow['status'], { label: string; classes: string }> = {
  open: { label: 'Open', classes: 'bg-alert-bg text-alert' },
  triaged: { label: 'Triaged', classes: 'bg-blue-bg text-blue' },
  in_progress: { label: 'In progress', classes: 'bg-blue-bg text-blue' },
  awaiting_tenant: { label: 'Needs you', classes: 'bg-amber-bg text-amber' },
  awaiting_contractor: { label: 'Awaiting fix', classes: 'bg-amber-bg text-amber' },
  resolved: { label: 'Done', classes: 'bg-forest-100 text-forest-700' },
  closed: { label: 'Closed', classes: 'bg-foam text-forest-700' },
  cancelled: { label: 'Cancelled', classes: 'bg-foam text-ink-light' },
};

export function MaintenanceSnapshotList({ rows }: { rows: MaintenanceSnapshotRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-light">
        No maintenance requests yet. Use <strong>Report an issue</strong> if something needs fixing.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border-soft">
      {rows.map((row) => {
        const category = TICKET_CATEGORY_RULES[row.category];
        const status = STATUS_CHIP[row.status];
        return (
          <li key={row.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-button text-[12px] font-bold',
                ICON_TINT[row.iconTone],
              )}
              aria-hidden="true"
            >
              {(category?.label ?? '?').slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-ink">{row.title}</div>
              <div className="mt-0.5 text-[11.5px] text-ink-light">
                Submitted {shortDate(row.reportedAt)} · {category?.label ?? row.category}
              </div>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
                status.classes,
              )}
            >
              {status.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short' });
}
