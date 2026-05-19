import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'warning' | 'danger';
};

const toneStyles = {
  default: 'bg-foam text-forest-600',
  warning: 'bg-amber-bg text-amber',
  danger: 'bg-alert-bg text-alert',
} as const;

export function StatCard({ label, value, hint, icon: Icon, tone = 'default' }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md ${toneStyles[tone]}`}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold">{value}</div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
