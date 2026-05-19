import type * as React from 'react';
import { cn } from '@/lib/cn';

export type TextareaProps = React.ComponentProps<'textarea'>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-[88px] w-full rounded-button border border-border-soft bg-white px-3 py-2 font-body text-[13px] text-ink ring-offset-background placeholder:text-ink-light focus-visible:border-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
