import { PAYMENT_BAND_LABEL, type PaymentBand } from '@/core/constants/passport';

const TONE: Record<PaymentBand, string> = {
  excellent: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  reliable: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  mixed: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  building: 'bg-muted text-muted-foreground',
  no_record: 'bg-muted text-muted-foreground',
};

export function PassportBandBadge({ band }: { band: PaymentBand }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[band]}`}
    >
      {PAYMENT_BAND_LABEL[band]}
    </span>
  );
}
