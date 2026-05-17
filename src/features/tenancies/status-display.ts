import type { TenancyStatus } from '@/core/schemas/tenancy';

/**
 * Centralised display labels and color tokens for tenancy status.
 * Used by both landlord and tenant surfaces — single source of truth.
 */
export type TenancyStatusDisplay = {
  label: string;
  /** Tailwind class for a soft tinted badge background + text. */
  tone: string;
};

const FALLBACK: TenancyStatusDisplay = {
  label: 'Unknown',
  tone: 'bg-muted text-muted-foreground',
};

const MAP: Record<TenancyStatus, TenancyStatusDisplay> = {
  draft: { label: 'Draft', tone: 'bg-muted text-muted-foreground' },
  pending_invite: {
    label: 'Awaiting tenant',
    tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  awaiting_signature: {
    label: 'Awaiting signature',
    tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  awaiting_deposit: {
    label: 'Awaiting deposit',
    tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  active: { label: 'Active', tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  ended: { label: 'Ended', tone: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', tone: 'bg-muted text-muted-foreground' },
};

export function tenancyStatusDisplay(status: TenancyStatus | string): TenancyStatusDisplay {
  return MAP[status as TenancyStatus] ?? FALLBACK;
}
