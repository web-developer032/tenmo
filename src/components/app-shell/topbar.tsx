'use client';

import { Search } from 'lucide-react';
import type * as React from 'react';
import { MobileDrawerTrigger } from './mobile-drawer';

/*
 * Sticky topbar that adapts to viewport:
 *
 *  - lg+: hamburger hidden; full breadcrumb + page title on the left,
 *    search input + role switcher + bell + avatar on the right.
 *  - md:  hamburger appears, search collapses to icon (rendered as a link
 *    today; the popover search input is out of scope for the reskin pass).
 *  - <md: hamburger + page title only on the left, bell + avatar on the
 *    right, role switcher tucked into user menu.
 *
 * The topbar itself is a thin client component so the hamburger trigger
 * can read drawer state from context. The actual content (role switcher,
 * inbox, notifications, user menu) is composed by the AppShell server
 * component and passed as children.
 */
export function Topbar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-(--layout-topbar-h) items-center gap-2 border-b border-border-soft bg-white/95 px-3 backdrop-blur lg:px-5">
      <MobileDrawerTrigger />
      {children}
    </header>
  );
}

export function TopbarTitle({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate font-sans text-[15px] font-bold leading-tight text-ink">{title}</div>
      {subtitle ? (
        <div className="hidden truncate text-[11.5px] font-medium text-ink-light md:block">
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

export function TopbarActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1 lg:gap-1.5">{children}</div>;
}

export function TopbarSearch({ placeholder = 'Search…' }: { placeholder?: string }) {
  return (
    <label className="relative hidden items-center md:flex">
      <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-light" />
      <input
        type="search"
        placeholder={placeholder}
        className="h-9 w-44 rounded-button border border-border-soft bg-white pl-7 pr-2.5 font-body text-[12.5px] text-ink placeholder:text-ink-light focus-visible:border-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600/20 lg:w-52"
      />
    </label>
  );
}
