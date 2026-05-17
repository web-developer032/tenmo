import { AST_STATUS_LABEL, AST_STATUS_TONE, type AstEnvelopeStatus } from '@/core/constants/ast';

const TONE_CLASS: Record<ReturnType<typeof toneFor>, string> = {
  default: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  destructive: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  secondary: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};

function toneFor(status: AstEnvelopeStatus) {
  return AST_STATUS_TONE[status];
}

/** Inline status pill for the AST envelope state. */
export function AstStatusBadge({ status }: { status: AstEnvelopeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[toneFor(status)]}`}
    >
      {AST_STATUS_LABEL[status]}
    </span>
  );
}
