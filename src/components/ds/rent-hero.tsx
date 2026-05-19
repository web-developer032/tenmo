import { Calendar, Home } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Tenant home rent banner from the mock's `.rent-hero`.
 *
 *  - Big forest-to-teal gradient surface, white text.
 *  - Big rent amount (mock: 48px); scales down on mobile (text-4xl) and up
 *    on desktop (text-6xl) so the figure is always the focal point.
 *  - Optional badge (e.g. "Paid on time") on the right at desktop, below
 *    the amount on mobile.
 *  - Tenancy progress bar at the bottom: anchored months_into / months_total.
 */

export type RentHeroProps = {
  amount: React.ReactNode;
  amountSuffix?: React.ReactNode;
  status?: { label: string; tone?: 'paid' | 'due' | 'overdue' };
  description?: React.ReactNode;
  progressPct?: number;
  progressLabel?: React.ReactNode;
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
};

const STATUS_TINT: Record<NonNullable<NonNullable<RentHeroProps['status']>['tone']>, string> = {
  paid: 'bg-white/20 text-white',
  due: 'bg-amber text-white',
  overdue: 'bg-alert text-white',
};

export function RentHero({
  amount,
  amountSuffix,
  status,
  description,
  progressPct,
  progressLabel,
  primary,
  secondary,
  className,
}: RentHeroProps) {
  const pct = typeof progressPct === 'number' ? Math.max(0, Math.min(100, progressPct)) : null;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-modal bg-gradient-to-br from-forest-600 to-forest-500 p-5 text-white shadow-(--shadow-card) lg:p-7',
        className,
      )}
    >
      <div aria-hidden className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
            <Home className="h-3.5 w-3.5" />
            Monthly rent
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="font-sans text-4xl font-extrabold leading-none tracking-tight sm:text-5xl lg:text-6xl">
              {amount}
            </div>
            {amountSuffix ? (
              <span className="text-[13px] font-medium opacity-80">{amountSuffix}</span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/85">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          {status ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-wide',
                STATUS_TINT[status.tone ?? 'paid'],
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {status.label}
            </span>
          ) : null}
          {primary ? <div className="flex gap-2">{primary}</div> : null}
          {secondary ? <div className="text-[12px] text-white/75">{secondary}</div> : null}
        </div>
      </div>
      {pct !== null ? (
        <div className="relative mt-5 border-t border-white/15 pt-4">
          <div className="flex items-center justify-between text-[12px] text-white/80">
            <span>Tenancy progress</span>
            <span className="font-semibold text-white">{progressLabel ?? `${pct}%`}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
