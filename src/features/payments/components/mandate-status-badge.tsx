import { TONE, type ToneName } from '@/components/ds/status-tone';
import {
  type GoCardlessMandateStatus,
  MANDATE_STATUS_LABEL,
  MANDATE_STATUS_TONE,
} from '@/core/constants/payments';

const VARIANT_TO_TONE: Record<ReturnType<typeof toneFor>, ToneName> = {
  default: 'neutral',
  secondary: 'neutral',
  success: 'forest',
  warning: 'amber',
  destructive: 'alert',
};

function toneFor(status: GoCardlessMandateStatus) {
  return MANDATE_STATUS_TONE[status];
}

/** Inline status pill for mandate state. Stays a `span` so it can be
 * dropped inside a card header or a list row. */
export function MandateStatusBadge({ status }: { status: GoCardlessMandateStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONE[VARIANT_TO_TONE[toneFor(status)]].chip}`}
    >
      {MANDATE_STATUS_LABEL[status]}
    </span>
  );
}
