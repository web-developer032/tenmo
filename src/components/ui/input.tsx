import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Tenantly / HMOeez input.
 *
 * 9 px radius (`--radius-button`), 1 px soft border, white surface. Focus
 * lifts the ring to forest. Tall enough for a 44 px touch target on mobile.
 */
export type InputProps = React.ComponentProps<'input'>;

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-button border border-border-soft bg-white px-3 py-2 font-body text-[13px] text-ink ring-offset-background placeholder:text-ink-light file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600/30 disabled:cursor-not-allowed disabled:opacity-50 lg:h-10',
        className,
      )}
      {...props}
    />
  );
}
