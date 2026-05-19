import { TrendingDown, TrendingUp } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * KPI tile from the mock's `.kpi-card` pattern.
 *
 * Accent stripe across the top maps to semantic state:
 *   forest  — neutral / on-track     (`--color-forest-600`)
 *   amber   — attention / due-soon   (`--color-amber`)
 *   red     — alert / overdue        (`--color-alert`)
 *   blue    — info / progress        (`--color-blue`)
 *
 * Delta is rendered as a pill: `up` (forest), `down` (alert), or `warn`
 * (amber). The component is server-renderable (no client state).
 */

export type KpiAccent = 'forest' | 'amber' | 'red' | 'blue' | 'purple';
export type KpiDelta = { value: string; tone: 'up' | 'down' | 'warn' | 'info' };

const ACCENT_BAR: Record<KpiAccent, string> = {
  forest: 'bg-forest-600',
  amber: 'bg-amber',
  red: 'bg-alert',
  blue: 'bg-blue',
  purple: 'bg-purple',
};

const ICON_TINT: Record<KpiAccent, string> = {
  forest: 'bg-forest-100 text-forest-700',
  amber: 'bg-amber-bg text-amber',
  red: 'bg-alert-bg text-alert',
  blue: 'bg-blue-bg text-blue',
  purple: 'bg-purple-bg text-purple',
};

const DELTA_TINT: Record<KpiDelta['tone'], string> = {
  up: 'bg-forest-100 text-forest-700',
  down: 'bg-alert-bg text-alert',
  warn: 'bg-amber-bg text-amber',
  info: 'bg-blue-bg text-blue',
};

export type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  accent?: KpiAccent;
  delta?: KpiDelta;
  sublabel?: string;
  className?: string;
};

export function KpiCard({
  label,
  value,
  icon,
  accent = 'forest',
  delta,
  sublabel,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card border border-border-soft bg-white p-4 lg:p-5',
        className,
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-1', ACCENT_BAR[accent])} />
      <div className="flex items-start justify-between gap-3">
        {icon ? (
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-button [&_svg]:size-4',
              ICON_TINT[accent],
            )}
          >
            {icon}
          </div>
        ) : null}
        {delta ? (
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              DELTA_TINT[delta.tone],
            )}
          >
            {delta.tone === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : delta.tone === 'down' ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {delta.value}
          </div>
        ) : null}
      </div>
      <div className="mt-3 font-sans text-[26px] font-extrabold leading-tight tracking-tight text-ink lg:text-[28px]">
        {value}
      </div>
      <div className="mt-1 text-[12.5px] font-medium text-ink-light">{label}</div>
      {sublabel ? (
        <div className="mt-1 text-[11.5px] font-medium text-ink-mid">{sublabel}</div>
      ) : null}
    </div>
  );
}
