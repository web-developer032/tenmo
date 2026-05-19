import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Tenantly / HMOeez badge.
 *
 * Variants map 1:1 to the `.badge-*` classes in the design mock:
 *
 *  paid     — forest on foam   ("Paid", "Active", "Live")
 *  due      — amber on amber-bg ("Due soon", "Pending")
 *  overdue  — alert on alert-bg ("Overdue", "Failed")
 *  urgent   — alert on alert-bg, slightly bolder ("Urgent")
 *  progress — blue on blue-bg  ("In progress")
 *  open     — blue on blue-bg  ("Open")
 *  valid    — forest on foam   ("Valid", "Verified")
 *  ending   — sand neutral     ("Ending", "Draft")
 *  neutral  — sand on light    ("Neutral", "Closed")
 *  active   — forest on foam   ("Active")
 *  outline  — transparent with forest text
 *
 * Existing variants (`default`, `secondary`, `destructive`, `success`,
 * `warning`) are preserved so older callsites keep working.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-forest-600 text-white',
        secondary: 'bg-foam text-forest-600',
        destructive: 'bg-alert text-white',
        outline: 'border border-border-soft text-forest-600',
        success: 'bg-forest-100 text-forest-700',
        warning: 'bg-amber-bg text-amber',
        paid: 'bg-forest-100 text-forest-700',
        due: 'bg-amber-bg text-amber',
        overdue: 'bg-alert-bg text-alert',
        urgent: 'bg-alert-bg text-alert',
        progress: 'bg-blue-bg text-blue',
        open: 'bg-blue-bg text-blue',
        valid: 'bg-forest-100 text-forest-700',
        ending: 'bg-sand text-ink-mid',
        neutral: 'bg-sand text-ink-mid',
        active: 'bg-forest-100 text-forest-700',
        info: 'bg-blue-bg text-blue',
        purple: 'bg-purple-bg text-purple',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
export type BadgeProps = React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
