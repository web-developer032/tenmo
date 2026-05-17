import type * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export type EmptyStateProps = React.ComponentProps<'div'> & {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)} {...props}>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        {icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {icon}
          </div>
        ) : null}
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? (
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
