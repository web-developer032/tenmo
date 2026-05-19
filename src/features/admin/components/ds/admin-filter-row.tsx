import type * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Flex row for filter controls (search + selects) above an admin table.
 *
 * Pure layout wrapper — children remain server-renderable form controls.
 * Mobile: stacks; desktop: row.
 */
export type AdminFilterRowProps = React.ComponentProps<'div'>;

export function AdminFilterRow({ className, children, ...rest }: AdminFilterRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
