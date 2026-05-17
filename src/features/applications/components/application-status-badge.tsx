import { Badge } from '@/components/ui/badge';
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from '@/core/constants/listings';

const VARIANT_BY_STATUS: Record<
  ApplicationStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'destructive',
  withdrawn: 'secondary',
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{APPLICATION_STATUS_LABEL[status]}</Badge>;
}
