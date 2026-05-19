'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Tenantly / HMOeez tabs.
 *
 * Mock: outer pill row in foam (light forest) with 10 px radius, inner
 * triggers at 7 px radius and turn white + forest text + soft shadow when
 * active.
 */
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1 rounded-[10px] bg-foam p-1 text-ink-mid',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-[7px] px-3 py-1.5 font-sans text-[12.5px] font-semibold ring-offset-background transition-all hover:text-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-forest-600 data-[state=active]:shadow-[0_1px_2px_rgba(15,110,86,0.12)]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        'mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600/30 focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    />
  );
}
