import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Small count pill from the mock's `.nav-badge`.
 *
 * Used in sidebar nav items ("Maintenance · 3 open") and in the topbar bell.
 * Variants are colour-tinted: default = forest, amber = warning,
 * red = alert, green = soft forest. Keep ultra-compact: 16 px tall, no
 * outline.
 */
const navBadgeVariants = cva(
  'inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold leading-none',
  {
    variants: {
      tone: {
        default: 'bg-forest-600 text-white',
        amber: 'bg-amber text-white',
        red: 'bg-alert text-white',
        green: 'bg-forest-100 text-forest-700',
        muted: 'bg-foam text-forest-600',
      },
    },
    defaultVariants: { tone: 'default' },
  },
);

export type NavBadgeProps = React.ComponentProps<'span'> & VariantProps<typeof navBadgeVariants>;

export function NavBadge({ tone, className, children, ...props }: NavBadgeProps) {
  return (
    <span className={cn(navBadgeVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}
