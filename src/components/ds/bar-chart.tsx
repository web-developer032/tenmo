import { cn } from '@/lib/cn';

/**
 * Pure-CSS bar chart matching the HMOeez mock `.bar-chart` pattern.
 *
 * One row of vertical bars, each with an optional value tag above and a
 * short label below. The current period is highlighted with the strong
 * forest accent; historical bars use the soft mint.
 *
 * No external charting dependency — keeps the bundle lean and lets the
 * component server-render.
 */

export type BarChartDatum = {
  label: string;
  value: number;
  displayValue?: string;
  highlight?: boolean;
};

export type BarChartProps = {
  data: BarChartDatum[];
  height?: number;
  variant?: 'forest' | 'foam' | 'purple';
  className?: string;
};

const VARIANT_HISTORY: Record<NonNullable<BarChartProps['variant']>, string> = {
  forest: 'bg-forest-200',
  foam: 'bg-forest-100',
  purple: 'bg-purple-bg',
};

const VARIANT_LATEST: Record<NonNullable<BarChartProps['variant']>, string> = {
  forest: 'bg-forest-600',
  foam: 'bg-forest-500',
  purple: 'bg-purple',
};

export function BarChart({ data, height = 120, variant = 'forest', className }: BarChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'rounded-card bg-bg-page p-6 text-center text-[12px] text-ink-light',
          className,
        )}
      >
        No data to chart yet.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn('flex items-end gap-2 px-1', className)} style={{ height: `${height}px` }}>
      {data.map((d) => {
        const pct = Math.max(4, Math.round((d.value / max) * 100));
        const fill = d.highlight ? VARIANT_LATEST[variant] : VARIANT_HISTORY[variant];
        return (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            {d.displayValue ? (
              <span
                className={cn(
                  'text-[10px] font-bold',
                  d.highlight ? 'text-forest-700' : 'text-ink-light',
                )}
              >
                {d.displayValue}
              </span>
            ) : null}
            <span
              className={cn('w-full rounded-t-md', fill)}
              style={{ height: `${pct}%` }}
              aria-hidden
            />
            <span className="text-[10px] text-ink-light">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
