import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PropertyComplianceSummary } from '../loaders';
import { complianceTypeLabel } from '../status-display';
import { ComplianceStatusBadge } from './compliance-status-badge';
import { ScorePill } from './score-pill';

/**
 * Per-property summary card on the compliance dashboard.
 *
 * Shows: property name + score, an overdue/due_soon counter strip, and
 * the up-to-three most urgent items as a teaser. Links to the property
 * detail page where the full breakdown lives.
 */
export function PropertyComplianceCard({
  slug,
  summary,
}: {
  slug: string;
  summary: PropertyComplianceSummary;
}) {
  const { property, groups, score, missing } = summary;
  const urgentItems = [...groups.overdue, ...groups.due_soon].slice(0, 3);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base">{property.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {property.address.city}
            {property.is_hmo ? ' · HMO' : ''}
          </p>
        </div>
        <ScorePill score={score} size="md" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          {groups.overdue.length > 0 && (
            <Badge variant="overdue">{groups.overdue.length} overdue</Badge>
          )}
          {groups.due_soon.length > 0 && (
            <Badge variant="due">{groups.due_soon.length} due soon</Badge>
          )}
          {missing.length > 0 && <Badge variant="neutral">{missing.length} missing</Badge>}
          {groups.ok.length > 0 && <Badge variant="valid">{groups.ok.length} in date</Badge>}
        </div>

        {urgentItems.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {urgentItems.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between rounded-button border border-border-soft bg-sand px-3 py-2"
              >
                <span className="truncate font-medium text-ink">
                  {complianceTypeLabel(it.type)}
                </span>
                <ComplianceStatusBadge status={it.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-button border border-forest-200 bg-forest-50 px-3 py-2 text-xs text-forest-700">
            All certificates are in date.
          </p>
        )}

        <div className="flex justify-end">
          <Link
            href={`/landlord/${slug}/properties/${property.id}`}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-forest-600 hover:underline"
          >
            View property
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
