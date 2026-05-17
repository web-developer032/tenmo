import { CalendarClock, FileWarning } from 'lucide-react';
import Link from 'next/link';
import type { ComplianceItem } from '@/core/schemas/compliance';
import { humaniseDeadline } from '@/core/utils/dates';
import { cn } from '@/lib/cn';
import { complianceTypeLabel } from '../status-display';
import { ComplianceStatusBadge } from './compliance-status-badge';

/**
 * Single-row visual for a compliance item. Used inside dense lists on the
 * dashboard and the property page. Always renders as a Link to the item's
 * edit page when `editHref` is supplied.
 */
export type ComplianceItemRowProps = {
  item: Pick<ComplianceItem, 'id' | 'type' | 'status' | 'expires_at' | 'issued_at'> & {
    property_name?: string | null;
  };
  editHref?: string;
  className?: string;
};

export function ComplianceItemRow({ item, editHref, className }: ComplianceItemRowProps) {
  const label = complianceTypeLabel(item.type);
  const deadline = item.expires_at ? humaniseDeadline(item.expires_at) : 'No expiry on file';

  const inner = (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border bg-card p-4 text-sm transition-colors hover:bg-muted/40',
        className,
      )}
    >
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-primary/10 text-primary">
        {item.status === 'unknown' ? (
          <FileWarning className="h-4 w-4" />
        ) : (
          <CalendarClock className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{label}</span>
          <ComplianceStatusBadge status={item.status} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          {item.property_name ? <span>{item.property_name}</span> : null}
          <span>{deadline}</span>
          {item.expires_at ? <span>· Expires {item.expires_at}</span> : null}
        </div>
      </div>
    </div>
  );

  if (editHref) {
    return (
      <Link
        href={editHref}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
