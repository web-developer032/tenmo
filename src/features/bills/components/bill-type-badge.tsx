import { BILL_TYPE_LABEL, type BillType } from '@/core/constants/bills';

const TONE_CLASS: Record<BillType, string> = {
  electricity: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  gas: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  water: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  council_tax: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  internet: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  tv_licence: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  other: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
};

export function BillTypeBadge({ type }: { type: BillType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[type]}`}
    >
      {BILL_TYPE_LABEL[type]}
    </span>
  );
}
