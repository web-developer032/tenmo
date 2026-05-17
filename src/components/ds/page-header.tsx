import type * as React from 'react';
import { cn } from '@/lib/cn';

export type PageHeaderProps = React.ComponentProps<'div'> & {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b pb-6 md:flex-row md:items-center md:justify-between',
        className,
      )}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground md:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
