'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Tiny URL-driven select. On change we merge the new value into the
 * existing search params and push the new URL — the page re-renders
 * on the server with the filter applied.
 *
 * `preserve` lets the caller decide which other params follow along.
 */
export function FilterSelect({
  name,
  value,
  basePath,
  preserve = [],
  children,
}: {
  name: string;
  value: string;
  basePath: string;
  preserve?: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams();
    for (const k of preserve) {
      const v = params.get(k);
      if (v) next.set(k, v);
    }
    if (e.target.value) next.set(name, e.target.value);
    // Reset page when filter changes
    next.delete('page');
    const qs = next.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ''}`);
  };

  return (
    <select
      name={name}
      defaultValue={value}
      onChange={onChange}
      className="h-9 rounded-button border border-border-soft bg-white px-2.5 text-[12.5px] font-medium text-ink focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200"
    >
      {children}
    </select>
  );
}
