import { TONE, type ToneName } from '@/components/ds/status-tone';
import { BILL_TYPE_LABEL, type BillType } from '@/core/constants/bills';

const TONE_BY_TYPE: Record<BillType, ToneName> = {
  electricity: 'amber',
  gas: 'amber',
  water: 'blue',
  council_tax: 'blue',
  internet: 'forest',
  tv_licence: 'neutral',
  other: 'neutral',
};

export function BillTypeBadge({ type }: { type: BillType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONE[TONE_BY_TYPE[type]].chip}`}
    >
      {BILL_TYPE_LABEL[type]}
    </span>
  );
}
