import { Badge } from '@/components/ui/badge';
import { LISTING_STATUS_LABEL, type ListingStatus } from '@/core/constants/listings';

const VARIANT_BY_STATUS: Record<
  ListingStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  published: 'success',
  paused: 'warning',
  closed: 'secondary',
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{LISTING_STATUS_LABEL[status]}</Badge>;
}
