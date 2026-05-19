import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Mini stat row from the mock's `.mini-stat-row` pattern.
 *
 * Renders as a 2-column flex line: muted label on the left, bold ink value
 * on the right. Used inside Cards for "Portfolio stats" and "Compliance
 * snapshot" summaries.
 */
export type MiniStatProps = {
  label: string;
  value: React.ReactNode;
  className?: string;
};

export function MiniStat({ label, value, className }: MiniStatProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border-soft py-2.5 text-[13px] last:border-b-0',
        className,
      )}
    >
      <span className="text-ink-light">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

export function MiniStatList({ children, className }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col', className)}>{children}</div>;
}
