import { formatMoney } from '@/core/utils/money';
import { cn } from '@/lib/cn';
import type { RecentPaymentRow } from '../types';

/**
 * Vertical timeline of recent rent activity — mirrors the design's
 * `.timeline-row` block on the Home page's "Recent payments" card.
 *
 * Status badges follow the tone palette from `KpiCard`/`Banner`:
 *   paid     → forest dot, "Paid" chip
 *   late     → amber dot,  "Nd late" chip
 *   due      → amber dot,  "Due" chip
 *   overdue  → alert dot,  "Overdue" chip
 */

const TONE: Record<
  RecentPaymentRow['status'],
  { dot: string; chip: string; label: (row: RecentPaymentRow) => string }
> = {
  paid: {
    dot: 'bg-forest-600',
    chip: 'bg-forest-100 text-forest-700',
    label: () => 'Paid',
  },
  late: {
    dot: 'bg-amber',
    chip: 'bg-amber-bg text-amber',
    label: (r) => (r.daysLate > 0 ? `${r.daysLate}d late` : 'Late'),
  },
  due: {
    dot: 'bg-amber',
    chip: 'bg-amber-bg text-amber',
    label: () => 'Due',
  },
  overdue: {
    dot: 'bg-alert',
    chip: 'bg-alert-bg text-alert',
    label: () => 'Overdue',
  },
};

export function RecentPaymentsTimeline({ rows }: { rows: RecentPaymentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-1 py-2 text-[12.5px] text-ink-light">
        No rent activity yet — once your landlord records a payment it will show here.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {rows.map((row, idx) => {
        const tone = TONE[row.status];
        const isLast = idx === rows.length - 1;
        return (
          <li key={row.id} className="flex gap-3">
            <div className="relative flex flex-col items-center">
              <span className={cn('mt-1 h-2.5 w-2.5 rounded-full', tone.dot)} />
              {!isLast ? <span className="mt-1 w-px flex-1 bg-border-soft" /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[13px] font-semibold text-ink">
                  {row.monthLabel} — {formatMoney(row.amountPence).replace(/\.00$/, '')}
                </div>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
                    tone.chip,
                  )}
                >
                  {tone.label(row)}
                </span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-light">
                {row.paidAt
                  ? `Received ${shortDate(row.paidAt)} · ${row.methodLabel}`
                  : `Due ${shortDate(row.dueDate)} · ${row.methodLabel}`}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short' });
}
