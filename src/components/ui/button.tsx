import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Tenantly / HMOeez button.
 *
 * Variants follow the design mock: primary = forest, ghost = white shell
 * with a soft border, destructive = alert orange-red. All buttons use the
 * 9 px button radius from `--radius-button` and the Plus Jakarta UI font.
 *
 * Sizes respect the responsive strategy: default touch target is 44 px on
 * mobile (`h-11`), collapsing to the desktop 9 px-height (~36 px) above
 * `lg`. Pass `size="sm"` to opt out of the mobile-tall variant for tight
 * toolbars.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-button)] font-sans text-[13px] font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-forest-600 text-white hover:bg-forest-700 active:bg-forest-700',
        primary: 'bg-forest-600 text-white hover:bg-forest-700 active:bg-forest-700',
        destructive: 'bg-alert text-white hover:brightness-95',
        outline:
          'border border-border-soft bg-white text-ink hover:bg-foam hover:border-forest-200',
        secondary: 'bg-foam text-forest-600 hover:bg-foam-dark',
        ghost: 'bg-white border border-border-soft text-ink hover:bg-foam',
        subtle: 'bg-transparent text-ink-mid hover:bg-foam hover:text-forest-600',
        link: 'text-forest-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 lg:h-9 lg:px-3.5',
        sm: 'h-9 px-3',
        lg: 'h-12 px-6 text-sm',
        icon: 'h-11 w-11 lg:h-9 lg:w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
