'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * Period chip group for `/admin/analytics`. Encodes its state via
 * `?period=` so deep links + Export CSV round-trip cleanly.
 */

const OPTIONS: Array<{ value: '3m' | '6m' | '12m' | 'ytd'; label: string }> = [
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '12m', label: '12M' },
  { value: 'ytd', label: 'YTD' },
];

export function AnalyticsPeriodPicker({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const setPeriod = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === '12m') {
      next.delete('period');
    } else {
      next.set('period', value);
    }
    const qs = next.toString();
    router.push(`/admin/analytics${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-button border border-border-soft bg-white p-1">
      {OPTIONS.map((opt) => {
        const isActive = opt.value === current;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPeriod(opt.value)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex h-7 items-center rounded-button px-2.5 text-[12px] font-semibold transition-colors',
              isActive
                ? 'bg-forest-100 text-forest-700'
                : 'text-ink-mid hover:bg-foam hover:text-forest-700',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
