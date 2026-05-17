import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  ADMIN_EVENT_KIND_VALUES,
  ADMIN_EVENT_LABEL,
  type AdminEventKind,
} from '@/core/constants/admin';
import { AdminListQuery } from '@/core/schemas/admin';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { AuditRow } from '@/features/admin/components/audit-row';
import { loadAdminAudit } from '@/features/admin/loaders';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    event?: string;
    target_user_id?: string;
    target_org_id?: string;
    page?: string;
    per_page?: string;
  }>;
}

/**
 * /admin/audit — full read of `admin_audit_log`. Filters via
 * URL params: `event=`, `target_user_id=`, `target_org_id=`,
 * `page=`, `per_page=`.
 */
export default async function AdminAuditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = AdminListQuery.parse({
    page: sp.page,
    per_page: sp.per_page,
  });

  const event: AdminEventKind | null =
    sp.event && (ADMIN_EVENT_KIND_VALUES as string[]).includes(sp.event)
      ? (sp.event as AdminEventKind)
      : null;

  const result = await loadAdminAudit({
    page: params.page,
    perPage: params.per_page,
    event,
    targetUserId: sp.target_user_id ?? null,
    targetOrgId: sp.target_org_id ?? null,
  });

  const hasFilter = event || sp.target_user_id || sp.target_org_id;

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          {result.total.toLocaleString('en-GB')} matching event
          {result.total === 1 ? '' : 's'}.
        </p>
      </header>

      <AdminNav />

      <Card>
        <CardHeader className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All events"
            active={!event}
            href={buildAuditHref({ ...sp, event: undefined })}
          />
          {ADMIN_EVENT_KIND_VALUES.map((k) => (
            <FilterChip
              key={k}
              label={ADMIN_EVENT_LABEL[k]}
              active={event === k}
              href={buildAuditHref({ ...sp, event: k, page: undefined })}
            />
          ))}
          {hasFilter ? (
            <Link
              href="/admin/audit"
              className="ml-auto text-muted-foreground text-xs hover:underline"
            >
              Clear filters
            </Link>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground text-sm" colSpan={5}>
                      No audit events match this filter.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((row) => <AuditRow key={row.id} row={row} />)
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            basePath="/admin/audit"
            page={result.page}
            totalPages={result.total_pages}
            preservedParams={{
              event: event ?? undefined,
              target_user_id: sp.target_user_id,
              target_org_id: sp.target_org_id,
              per_page: params.per_page === 25 ? undefined : String(params.per_page),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FilterChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-0.5 text-xs ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {label}
    </Link>
  );
}

function buildAuditHref(sp: {
  event?: string;
  target_user_id?: string;
  target_org_id?: string;
  page?: string;
  per_page?: string;
}): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, v);
  }
  const qs = usp.toString();
  return `/admin/audit${qs ? `?${qs}` : ''}`;
}
