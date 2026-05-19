import { TONE, type ToneName } from '@/components/ds/status-tone';
import { PAYMENT_BAND_LABEL, type PaymentBand } from '@/core/constants/passport';

const BAND_TO_TONE: Record<PaymentBand, ToneName> = {
  excellent: 'forest',
  reliable: 'forest',
  mixed: 'amber',
  building: 'neutral',
  no_record: 'neutral',
};

export function PassportBandBadge({ band }: { band: PaymentBand }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONE[BAND_TO_TONE[band]].chip}`}
    >
      {PAYMENT_BAND_LABEL[band]}
    </span>
  );
}
