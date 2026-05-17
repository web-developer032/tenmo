import { Badge } from '@/components/ui/badge';
import type { ComplianceStatus } from '@/core';
import { cn } from '@/lib/cn';

const LABELS: Record<ComplianceStatus, string> = {
  ok: 'OK',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  unknown: 'Unknown',
};

const VARIANTS: Record<ComplianceStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ok: 'success',
  due_soon: 'warning',
  overdue: 'destructive',
  unknown: 'secondary',
};

export type StatusBadgeProps = {
  status: ComplianceStatus;
  className?: string;
  label?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge variant={VARIANTS[status]} className={cn('capitalize', className)}>
      {label ?? LABELS[status]}
    </Badge>
  );
}
