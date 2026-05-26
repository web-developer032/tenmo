import type { TenantPrimaryTenancy } from '../types';
import { TenancyDetailList } from './tenancy-detail-list';

/**
 * Emergency contacts card — the landlord's contact details plus a set of
 * static UK national emergency numbers (gas, electric, water, police). The
 * national set is hardcoded because they're regulated, universal in the UK
 * and don't belong in the database.
 *
 * Per the design we surface up to 5 rows. If we don't have the landlord's
 * phone we fall back to email; if we don't have either, the row is
 * suppressed rather than rendering an empty value.
 */

export function EmergencyContacts({ tenancy }: { tenancy: TenantPrimaryTenancy }) {
  const landlordValue = tenancy.landlord.contactPhone ?? tenancy.landlord.contactEmail ?? null;

  const rows = [
    landlordValue
      ? {
          label: 'Landlord',
          value: `${tenancy.landlord.displayName} · ${landlordValue}`,
          emphasis: 'forest' as const,
        }
      : null,
    { label: 'Gas emergency', value: 'National Gas · 0800 111 999' },
    { label: 'Electric emergency', value: 'Power network · 105' },
    { label: 'Water emergency', value: 'Local water supplier · check your bill' },
    { label: 'Police (non-emergency)', value: '101' },
  ].filter((r): r is { label: string; value: string; emphasis?: 'forest' } => r !== null);

  return <TenancyDetailList rows={rows} />;
}
