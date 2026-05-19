import { cn } from '@/lib/cn';

/**
 * Labelled progress bar from the HMOeez mock's feature-adoption rows.
 *
 * Used on /admin/analytics to show what % of active landlords use each
 * Tenantly feature. Tone follows the score band:
 *
 *   ≥ 80%  → forest    (strong adoption)
 *   ≥ 60%  → teal      (good)
 *   ≥ 40%  → blue      (mid)
 *   < 40%  → amber     (under-used)
 */

export type AdminFeatureBarProps = {
  label: string;
  /** 0-100 percentage. Values are clamped. */
  value: number;
  className?: string;
};

function toneFor(value: number): { fill: string; text: string } {
  if (value >= 80) return { fill: 'bg-forest-600', text: 'text-forest-700' };
  if (value >= 60) return { fill: 'bg-forest-500', text: 'text-forest-600' };
  if (value >= 40) return { fill: 'bg-blue', text: 'text-blue' };
  return { fill: 'bg-amber', text: 'text-amber' };
}

export function AdminFeatureBar({ label, value, className }: AdminFeatureBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const t = toneFor(pct);
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className={cn('font-bold', t.text)}>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg-page">
        <div
          className={cn('h-full rounded-full transition-all', t.fill)}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}
