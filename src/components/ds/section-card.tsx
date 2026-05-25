import type * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Card-with-header from the HMOeez mock's `.card` + `.card-header` /
 * `.card-body` pattern. Used everywhere a section needs a title row,
 * optional right-aligned action, and a body slot.
 *
 *   <SectionCard title="Rent status" action={<Link>View all →</Link>}>
 *     ...body...
 *   </SectionCard>
 *
 * Use `padded={false}` when the body owns its own padding (e.g. a
 * `DataTable` that should bleed to the card edges).
 */

export type SectionCardProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
};

export function SectionCard({
  title,
  subtitle,
  action,
  padded = true,
  className,
  bodyClassName,
  children,
}: SectionCardProps) {
  const hasHeader = title != null || subtitle != null || action != null;
  return (
    <section
      className={cn('overflow-hidden rounded-card border border-border-soft bg-white', className)}
    >
      {hasHeader ? (
        <header className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            {title ? (
              <div className="font-sans text-[14px] font-bold leading-tight tracking-tight text-ink">
                {title}
              </div>
            ) : null}
            {subtitle ? <div className="mt-0.5 text-[12px] text-ink-light">{subtitle}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn(padded ? 'px-4 py-3 sm:px-5 sm:py-4' : '', bodyClassName)}>{children}</div>
    </section>
  );
}
