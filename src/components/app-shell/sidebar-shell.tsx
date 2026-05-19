'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type * as React from 'react';
import { NavBadge, type NavBadgeProps } from '@/components/ds/nav-badge';
import { cn } from '@/lib/cn';

/*
 * Shared sidebar chrome used by Landlord, Tenant and Admin sidebars.
 *
 * - `SidebarShell` is the visual frame (logo at top, scrollable nav,
 *   optional footer). It picks up the design-token sidebar width.
 * - `SidebarSection` groups items under an uppercase section label
 *   ("Landlord", "Shared", "My Home", "Communication", "Account").
 * - `SidebarNavItem` renders one link with icon + label + optional badge.
 *   Active state is computed from `usePathname` to highlight the current
 *   route, exactly matching the mock's `.nav-item.active` treatment.
 */

export type SidebarNavItemProps = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: { count: number | string; tone?: NavBadgeProps['tone'] };
  /** Match logic: defaults to "equal or startsWith /". */
  match?: (pathname: string) => boolean;
};

export function SidebarNavItem({ href, label, icon: Icon, badge, match }: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive = match ? match(pathname) : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-2.5 rounded-nav px-2.5 py-2 font-sans text-[13px] font-medium transition-colors',
        isActive
          ? 'bg-foam text-forest-700'
          : 'text-ink-mid hover:bg-foam/60 hover:text-forest-700',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          isActive ? 'text-forest-600' : 'text-ink-light group-hover:text-forest-600',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? <NavBadge tone={badge.tone}>{badge.count}</NavBadge> : null}
    </Link>
  );
}

export function SidebarSection({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-1', className)}>
      {label ? (
        <div className="mb-1 px-2.5 pt-3 font-sans text-[10.5px] font-bold uppercase tracking-wider text-ink-light">
          {label}
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function SidebarHeader({
  brand,
  subline,
  badge,
}: {
  brand: string;
  subline?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-4">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-forest-600 text-white"
        aria-hidden
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <title>Tenantly logo</title>
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-sans text-[16px] font-extrabold leading-tight text-ink">
            {brand}
          </span>
          {badge}
        </div>
        {subline ? (
          <div className="truncate text-[11px] font-medium text-ink-light">{subline}</div>
        ) : null}
      </div>
    </div>
  );
}

export function SidebarShell({
  header,
  children,
  footer,
  className,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full flex-col border-r border-border-soft bg-white', className)}>
      {header}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2" aria-label="Primary navigation">
        {children}
      </nav>
      {footer ? <div className="border-t border-border-soft px-3 py-3">{footer}</div> : null}
    </div>
  );
}

export function SidebarFooter({
  initials,
  name,
  sub,
}: {
  initials: string;
  name: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foam font-sans text-[12px] font-bold text-forest-700">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-[13px] font-semibold text-ink">{name}</div>
        {sub ? <div className="truncate text-[11px] font-medium text-ink-light">{sub}</div> : null}
      </div>
    </div>
  );
}
