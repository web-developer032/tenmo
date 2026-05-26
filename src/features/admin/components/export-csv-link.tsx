import { Download } from 'lucide-react';
import Link from 'next/link';

/**
 * Replaces the disabled placeholder Export buttons. Renders as an
 * `<a download>` so the browser handles the file save dialog — no
 * extra JS / no client component. Carries the current filter set as
 * search params so the download mirrors what's on screen.
 */
export function ExportCsvLink({
  href,
  label = 'Export CSV',
  filenameHint,
}: {
  href: string;
  label?: string;
  filenameHint?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      download={filenameHint ?? undefined}
      className="inline-flex h-9 items-center gap-1.5 rounded-button border border-border-soft bg-white px-3 text-[13px] font-semibold text-ink-mid transition-colors hover:bg-foam hover:text-forest-700"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}

/**
 * Helper to build a query string from current page filters,
 * dropping `undefined`, empty strings and `'all'` values that the
 * loaders treat as "no filter".
 */
export function buildExportQuery(
  params: Record<string, string | number | null | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const str = String(v);
    if (str === '' || str === 'all') continue;
    usp.set(k, str);
  }
  const q = usp.toString();
  return q ? `?${q}` : '';
}
