import { TONE, type ToneName } from '@/components/ds/status-tone';
import type { TenancyStatus } from '@/core/schemas/tenancy';

/**
 * Centralised display labels and color tokens for tenancy status.
 * Used by both landlord and tenant surfaces — single source of truth.
 */
export type TenancyStatusDisplay = {
  label: string;
  toneName: ToneName;
  /** Tailwind class for a soft tinted badge background + text. */
  tone: string;
};

function row(label: string, toneName: ToneName): TenancyStatusDisplay {
  return { label, toneName, tone: TONE[toneName].chip };
}

const FALLBACK: TenancyStatusDisplay = row('Unknown', 'neutral');

const MAP: Record<TenancyStatus, TenancyStatusDisplay> = {
  draft: row('Draft', 'neutral'),
  pending_invite: row('Awaiting tenant', 'amber'),
  awaiting_signature: row('Awaiting signature', 'amber'),
  awaiting_deposit: row('Awaiting deposit', 'amber'),
  active: row('Active', 'forest'),
  ended: row('Ended', 'neutral'),
  cancelled: row('Cancelled', 'neutral'),
};

export function tenancyStatusDisplay(status: TenancyStatus | string): TenancyStatusDisplay {
  return MAP[status as TenancyStatus] ?? FALLBACK;
}
