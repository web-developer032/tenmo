import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * Pill-style filter tabs from the HMOeez mock (`.tab-row`).
 *
 * Different from `components/ui/tabs.tsx` which is a Radix-driven
 * controlled component. This is a thin SSR-friendly list that
 * navigates via `?tab=` query params or any other URL the page picks.
 */

export type AdminTabItem = {
  id: string;
  label: string;
  href: string;
  count?: number;
};

export type AdminTabBarProps = {
  items: AdminTabItem[];
  activeId: string;
  className?: string;
};

export function AdminTabBar({ items, activeId, className }: AdminTabBarProps) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-card border border-border-soft bg-white p-1',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'rounded-button px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors',
              isActive
                ? 'bg-forest-600 text-white'
                : 'text-ink-light hover:bg-foam hover:text-forest-700',
            )}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span className={cn('ml-1.5', isActive ? 'text-white/80' : 'text-ink-light')}>
                ({item.count})
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
