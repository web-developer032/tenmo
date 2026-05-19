import { ShieldCheck } from 'lucide-react';
import type { ComplianceStatus, ComplianceType } from '@/core/constants/compliance';
import { cn } from '@/lib/cn';
import { complianceTypeLabel } from '../status-display';
import { ComplianceStatusBadge } from './compliance-status-badge';

/**
 * Compact summary shown on the tenant dashboard for each active tenancy,
 * giving them visibility on the property's safety certificate status.
 *
 * Tenants are entitled by law to a copy of gas safety, EICR and EPC
 * certificates. This widget shows the at-a-glance status; the full
 * download experience lives behind a "View certificates" link (future).
 */
type Item = {
  id: string;
  type: ComplianceType;
  status: ComplianceStatus;
  expires_at: string | null;
};

export function TenantComplianceSummary({
  items,
  className,
}: {
  items: Item[];
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          'rounded-button border border-dashed border-border-soft bg-sand px-3 py-2 text-xs text-ink-light',
          className,
        )}
      >
        No safety certificates on file yet — your landlord will upload them shortly.
      </div>
    );
  }

  const overdue = items.filter((i) => i.status === 'overdue').length;
  const due = items.filter((i) => i.status === 'due_soon').length;
  const ok = items.filter((i) => i.status === 'ok').length;

  const tone =
    overdue > 0
      ? 'border-alert/30 bg-alert-bg'
      : due > 0
        ? 'border-amber/30 bg-amber-bg'
        : 'border-forest-200 bg-forest-50';

  return (
    <div className={cn('space-y-2 rounded-button border px-3 py-3 text-sm', tone, className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-forest-600" />
          Safety certificates
        </span>
        <span className="text-xs text-ink-light">
          {ok} in date · {due} due soon · {overdue} overdue
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center justify-between gap-2 rounded-button border border-border-soft bg-white px-2.5 py-1.5"
          >
            <span className="truncate text-ink">{complianceTypeLabel(it.type)}</span>
            <ComplianceStatusBadge status={it.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
