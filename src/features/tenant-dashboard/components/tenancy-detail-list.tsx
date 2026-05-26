import type * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Label / value rows from the design's `.tenancy-detail-row` pattern.
 *
 * Used by:
 *  - Home "My home" card
 *  - Home "Emergency contacts" card
 *  - Profile "My tenancy" read-only summary
 *
 * `value` may be a string, ReactNode or `null`; we render an em-dash for
 * nullish values so the row stays balanced.
 */

export type DetailRow = {
  label: string;
  value: React.ReactNode;
  emphasis?: 'default' | 'forest';
};

export function TenancyDetailList({ rows, className }: { rows: DetailRow[]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-border-soft', className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-light">
            {row.label}
          </dt>
          <dd
            className={cn(
              'text-right text-[13px] font-semibold',
              row.emphasis === 'forest' ? 'text-forest-700' : 'text-ink',
            )}
          >
            {row.value ?? <span className="text-ink-light">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
