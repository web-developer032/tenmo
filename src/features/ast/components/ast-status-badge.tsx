import { TONE, type ToneName } from '@/components/ds/status-tone';
import { AST_STATUS_LABEL, AST_STATUS_TONE, type AstEnvelopeStatus } from '@/core/constants/ast';

const VARIANT_TO_TONE: Record<ReturnType<typeof toneFor>, ToneName> = {
  default: 'neutral',
  secondary: 'neutral',
  success: 'forest',
  warning: 'amber',
  destructive: 'alert',
};

function toneFor(status: AstEnvelopeStatus) {
  return AST_STATUS_TONE[status];
}

/** Inline status pill for the AST envelope state. */
export function AstStatusBadge({ status }: { status: AstEnvelopeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONE[VARIANT_TO_TONE[toneFor(status)]].chip}`}
    >
      {AST_STATUS_LABEL[status]}
    </span>
  );
}
