import Link from 'next/link';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Page header from the mock's per-page top strip: title + breadcrumb + an
 * optional action slot for primary CTAs.
 *
 * Mobile: title only on a single line; actions wrap below the title.
 * Desktop: actions sit to the right of the title block.
 */

export type Breadcrumb = { label: string; href?: string };

export type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="mb-1 flex flex-wrap items-center gap-1 text-[12px] text-ink-light">
            {breadcrumbs.map((crumb, i) => (
              <span
                key={`${crumb.label}-${crumb.href ?? 'static'}`}
                className="inline-flex items-center gap-1"
              >
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-forest-600">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
                {i < breadcrumbs.length - 1 ? <span aria-hidden>·</span> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="font-sans text-[20px] font-bold leading-tight tracking-tight text-ink lg:text-[22px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-light">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
