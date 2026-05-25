import type * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Flex row for filter controls (search + selects) above a table.
 *
 * Pure layout wrapper — children remain server-renderable form controls.
 * Mobile: stacks; desktop: row.
 */
export type FilterRowProps = React.ComponentProps<'div'>;

export function FilterRow({ className, children, ...rest }: FilterRowProps) {
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
