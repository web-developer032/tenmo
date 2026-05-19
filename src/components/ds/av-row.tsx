import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Avatar + name + sub stack from the mock's `.av-row` pattern.
 *
 * Used in tenant lists, contractor directory, applicant queues. Initials
 * fall back when no image is supplied. Size variants: `sm` (28 px) for
 * dense rows, `md` (36 px) default, `lg` (44 px) for hero placements.
 */

export type AvSize = 'sm' | 'md' | 'lg';

const SIZE: Record<AvSize, { box: string; text: string }> = {
  sm: { box: 'h-7 w-7 text-[10.5px]', text: 'text-[12.5px]' },
  md: { box: 'h-9 w-9 text-[11.5px]', text: 'text-[13px]' },
  lg: { box: 'h-11 w-11 text-[13px]', text: 'text-[14px]' },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export type AvRowProps = {
  name: string;
  sub?: React.ReactNode;
  imageUrl?: string | null;
  size?: AvSize;
  className?: string;
  trailing?: React.ReactNode;
};

export function AvRow({ name, sub, imageUrl, size = 'md', className, trailing }: AvRowProps) {
  const s = SIZE[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full bg-foam font-sans font-bold text-forest-700',
          s.box,
        )}
        aria-hidden={!!imageUrl}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-semibold text-ink', s.text)}>{name}</span>
        {sub ? <span className="block truncate text-[12px] text-ink-light">{sub}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </div>
  );
}
