import {
  type GoCardlessMandateStatus,
  MANDATE_STATUS_LABEL,
  MANDATE_STATUS_TONE,
} from '@/core/constants/payments';

const TONE_CLASS: Record<ReturnType<typeof toneFor>, string> = {
  default: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  destructive: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  secondary: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};

function toneFor(status: GoCardlessMandateStatus) {
  return MANDATE_STATUS_TONE[status];
}

/** Inline status pill for mandate state. Stays a `span` so it can be
 * dropped inside a card header or a list row. */
export function MandateStatusBadge({ status }: { status: GoCardlessMandateStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[toneFor(status)]}`}
    >
      {MANDATE_STATUS_LABEL[status]}
    </span>
  );
}
