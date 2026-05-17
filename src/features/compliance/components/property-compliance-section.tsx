import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplianceItem } from '@/core/schemas/compliance';
import type {
  GroupedCompliance,
  missingRequiredTypes,
  requiredItemsForProperty,
} from '@/core/utils/compliance-rules';
import { complianceTypeLabel } from '../status-display';
import { ComplianceItemRow } from './compliance-item-row';
import { ScorePill } from './score-pill';
import { SeedRequiredButton } from './seed-required-button';

/**
 * Compliance section embedded on the property detail page. Reuses loaders
 * data so it doesn't issue extra queries.
 */
export type PropertyComplianceSectionProps = {
  orgId: string;
  orgSlug: string;
  propertyId: string;
  data: {
    items: ReturnType<typeof ComplianceItem.parse>[];
    groups: GroupedCompliance<ReturnType<typeof ComplianceItem.parse>>;
    score: number;
    missing: ReturnType<typeof missingRequiredTypes>;
    required: ReturnType<typeof requiredItemsForProperty>;
  } | null;
};

export function PropertyComplianceSection({
  orgId,
  orgSlug,
  propertyId,
  data,
}: PropertyComplianceSectionProps) {
  if (!data) return null;

  const { items, missing, score } = data;
  const sorted = [...items].sort((a, b) => priority(a.status) - priority(b.status));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            Compliance
          </CardTitle>
          <CardDescription>
            Track every certificate this property is required to hold. We&apos;ll remind you before
            they expire.
          </CardDescription>
        </div>
        <ScorePill score={score} size="md" />
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="mb-3">
              No certificates on file yet. Set up the legally-required ones with one click — you can
              fill in dates as you find each cert.
            </p>
            <div className="flex flex-wrap gap-2">
              <SeedRequiredButton orgId={orgId} propertyId={propertyId} />
              <Button asChild variant="ghost">
                <Link href={`/landlord/${orgSlug}/compliance/new?property_id=${propertyId}`}>
                  Add manually
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {sorted.map((it) => (
              <li key={it.id}>
                <ComplianceItemRow
                  item={it}
                  editHref={`/landlord/${orgSlug}/compliance/${it.id}`}
                />
              </li>
            ))}
          </ul>
        )}

        {missing.length > 0 && (
          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm">
            <p className="font-medium">Recommended next:</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {missing.map((t) => (
                <li key={t}>
                  <Link
                    href={`/landlord/${orgSlug}/compliance/new?property_id=${propertyId}&type=${t}`}
                    className="inline-flex items-center rounded-full border border-dashed px-3 py-1 text-xs hover:bg-muted"
                  >
                    + {complianceTypeLabel(t)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/landlord/${orgSlug}/compliance/new?property_id=${propertyId}`}>
              Add certificate
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function priority(status: 'overdue' | 'due_soon' | 'unknown' | 'ok'): number {
  switch (status) {
    case 'overdue':
      return 0;
    case 'due_soon':
      return 1;
    case 'unknown':
      return 2;
    case 'ok':
      return 3;
  }
}
