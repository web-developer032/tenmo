import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

/**
 * Server-rendered pagination control used by every admin list. Pure
 * — takes the current `page`, `total_pages`, the base path and an
 * optional set of preserved query params.
 */
export function AdminPagination({
  basePath,
  page,
  totalPages,
  preservedParams,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  preservedParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const buildHref = (target: number) => {
    const sp = new URLSearchParams();
    for (const [key, val] of Object.entries(preservedParams)) {
      if (val !== undefined && val !== null && val !== '') sp.set(key, val);
    }
    if (target > 1) sp.set('page', String(target));
    else sp.delete('page');
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ''}`;
  };

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t pt-3 text-sm"
    >
      <Link
        href={buildHref(prev)}
        aria-disabled={page <= 1}
        className={`inline-flex items-center gap-1 rounded px-3 py-1.5 ${
          page <= 1 ? 'pointer-events-none text-muted-foreground/50' : 'hover:bg-muted'
        }`}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Link>
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Link
        href={buildHref(next)}
        aria-disabled={page >= totalPages}
        className={`inline-flex items-center gap-1 rounded px-3 py-1.5 ${
          page >= totalPages ? 'pointer-events-none text-muted-foreground/50' : 'hover:bg-muted'
        }`}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}
