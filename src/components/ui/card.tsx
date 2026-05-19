import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Tenantly / HMOeez card.
 *
 * 14 px radius (`--radius-card`), 1 px soft border, white surface, no heavy
 * shadow — matches `.card` from the mock. CardHeader uses a tighter
 * horizontal padding so titles and trailing actions sit on the same baseline
 * as in `.card-header`.
 */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-card border border-border-soft bg-card text-card-foreground shadow-(--shadow-card)',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3.5 lg:px-5',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'font-sans text-[14px] font-bold leading-none tracking-tight text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('text-xs text-ink-light', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-4 lg:p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center border-t border-border-soft px-4 py-3.5 lg:px-5', className)}
      {...props}
    />
  );
}

export function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('text-[12.5px] font-semibold text-forest-600 hover:underline', className)}
      {...props}
    />
  );
}
