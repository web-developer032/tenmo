'use client';

import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Input } from '@/components/ui/input';

/**
 * Tiny client search field used by the admin list pages.
 *
 * Submits on Enter (no debouncing) so the URL stays the source of
 * truth for "what am I looking at?" — a server-rendered list always
 * reflects the URL.
 */
export function AdminSearchInput({
  basePath,
  initialValue,
  placeholder = 'Search…',
}: {
  basePath: string;
  initialValue: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = React.useState(initialValue);

  const submit = (next: string) => {
    const sp = new URLSearchParams(params?.toString() ?? '');
    if (next) sp.set('q', next);
    else sp.delete('q');
    sp.delete('page'); // reset pagination on a new query
    router.push(`${basePath}${sp.toString() ? `?${sp.toString()}` : ''}`);
  };

  return (
    <search className="relative max-w-sm flex-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value.trim());
        }}
      >
        <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
        />
      </form>
    </search>
  );
}
